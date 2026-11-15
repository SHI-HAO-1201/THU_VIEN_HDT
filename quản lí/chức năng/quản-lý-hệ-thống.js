(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var auditTable = document.getElementById("auditTable");
  var backupTable = document.getElementById("backupsTable");
  var auditSearch = document.getElementById("auditSearch");
  var backupForm = document.getElementById("backupSettingsForm");
  var reportStats = null;
  var reportRange = { from: "", to: "" };
  function escape(value) { return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value); }
  function csvCell(value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; }
  function renderTrend(points) {
    var svg = document.querySelector(".bar-chart-svg");
    if (!svg || !points || !points.length) return;
    var bars = Array.from(svg.querySelectorAll("rect"));
    var labels = Array.from(svg.querySelectorAll("text")).filter(function (node) { return Number(node.getAttribute("y")) === 196; });
    var maximum = Math.max(1, ...points.map(function (point) { return Math.max(Number(point.loans), Number(point.returns)); }));
    var scale = 155 / maximum;
    points.forEach(function (point, index) {
      var loanBar = bars[index * 2], returnBar = bars[index * 2 + 1];
      [[loanBar, point.loans], [returnBar, point.returns]].forEach(function (entry) {
        if (!entry[0]) return;
        var height = Math.max(1, Number(entry[1]) * scale);
        entry[0].setAttribute("height", height.toFixed(1));
        entry[0].setAttribute("y", (180 - height).toFixed(1));
      });
      if (labels[index]) labels[index].textContent = point.label;
    });
    var ticks = Array.from(svg.querySelectorAll("text")).filter(function (node) { return Number(node.getAttribute("x")) === 28; });
    ticks.forEach(function (tick, index) { tick.textContent = String(Math.round(maximum * (4 - index) / 4)); });
  }
  function exportReport() {
    if (!reportStats) { global.MocThu.thanhPhan.hienThongBao("Thống kê đang tải, hãy thử lại sau."); return; }
    var rows = [["Báo cáo thư viện", "Giá trị"], ["Tổng đầu sách", reportStats.books], ["Tổng bản sách", reportStats.copies], ["Đang mượn", reportStats.openLoans], ["Quá hạn", reportStats.overdueLoans], ["Độc giả hoạt động", reportStats.activeReaders], ["Thẻ thư viện hoạt động", reportStats.activeCards], ["Tiền phạt chưa thu", reportStats.unpaidFines], ["Tiền phạt ghi nhận tháng này", reportStats.lateFinesThisMonth], [], ["Thể loại", "Đầu sách", "Tổng bản", "Đang mượn"]];
    (reportStats.categoryStats || []).forEach(function (item) { rows.push([item.category, item.title_count, item.copies, item.borrowed]); });
    rows.push([], ["Sách lưu hành nhiều", "Mã sách", "Lượt mượn"]);
    (reportStats.topBooks || []).forEach(function (item) { rows.push([item.name, item.code, item.loan_count]); });
    var csv = "\uFEFF" + rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var link = document.createElement("a"); link.href = url; link.download = "bao-cao-thu-vien.csv"; link.click(); URL.revokeObjectURL(url);
  }
  async function loadAudit() {
    if (!auditTable) return;
    try {
      var result = await api("/api/audit?q=" + encodeURIComponent(auditSearch.value.trim()));
      auditTable.innerHTML = result.events.length ? result.events.map(function (row) {
        return '<tr><td>' + new Date(row.created_at).toLocaleString("vi-VN") + '</td><td>' + escape(row.full_name || row.username || "Hệ thống") + '</td><td>' + escape(row.action) + '</td><td>' + escape(row.detail) + '</td></tr>';
      }).join("") : '<tr><td class="table-empty" colspan="4">Không có sự kiện phù hợp.</td></tr>';
    } catch (error) { auditTable.innerHTML = '<tr><td class="table-empty" colspan="4">' + escape(error.message) + '</td></tr>'; }
  }
  async function loadBackups() {
    if (!backupTable) return;
    try {
      var result = await api("/api/backups");
      backupTable.innerHTML = result.backups.length ? result.backups.map(function (item) {
        return '<tr><td><strong>' + escape(item.filename) + '</strong></td><td>' + new Date(item.modifiedAt).toLocaleString("vi-VN") + '</td><td>' + (item.size / 1024).toFixed(1) + ' KB</td><td><button class="button small soft" data-restore-backup="' + escape(item.filename) + '" type="button">Khôi phục</button></td></tr>';
      }).join("") : '<tr><td class="table-empty" colspan="4">Chưa có bản sao lưu.</td></tr>';
    } catch (error) { backupTable.innerHTML = '<tr><td class="table-empty" colspan="4">' + escape(error.message) + '</td></tr>'; }
  }
  async function loadSettings() {
    if (!backupForm) return;
    try {
      var result = await api("/api/backup-settings");
      backupForm.elements.intervalDays.value = result.settings.interval_days;
      backupForm.elements.enabled.checked = Boolean(result.settings.enabled);
      document.getElementById("backupLastRun").textContent = result.settings.last_backup_at ? "Sao lưu gần nhất: " + new Date(result.settings.last_backup_at).toLocaleString("vi-VN") : "Chưa có bản sao lưu.";
    } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
  }
  async function loadStats(range) {
    var titleNode = document.getElementById("statTitles");
    if (!titleNode) return;
    try {
      var params = new URLSearchParams(range || reportRange);
      var result = await api("/api/stats?" + params.toString());
      var stats = result.stats;
      reportStats = stats;
      renderTrend(stats.trend);
      titleNode.textContent = String(stats.books);
      document.getElementById("statOpenLoans").innerHTML = escape(stats.openLoans) + ' <span class="unit">lượt</span>';
      document.getElementById("statUnpaidFines").innerHTML = Number(stats.unpaidFines).toLocaleString("vi-VN") + ' <span class="unit">đ</span>';
      document.getElementById("statLowStock").innerHTML = escape(stats.lowStock) + ' <span class="unit">đầu sách</span>';
      var reportFines = document.getElementById("reportFinesMonth");
      if (reportFines) reportFines.innerHTML = Number(stats.finesInPeriod ?? stats.lateFinesThisMonth).toLocaleString("vi-VN") + ' <span class="unit">đ</span>';
      var reportLoans = document.getElementById("reportLoansMonth");
      if (reportLoans) reportLoans.innerHTML = escape(stats.loansInPeriod ?? stats.loansThisMonth) + ' <span class="unit">lượt</span>';
      var ratio = stats.copies ? (Number(stats.openLoans) * 100 / Number(stats.copies)) : 0;
      var resourceRatio = document.getElementById("reportResourceRatio");
      if (resourceRatio) resourceRatio.innerHTML = ratio.toFixed(1) + ' <span class="unit">%</span>';
      var returns = Number(stats.totalReturnsInPeriod ?? stats.totalReturns);
      var onTimeReturns = Number(stats.onTimeReturnsInPeriod ?? stats.onTimeReturns);
      var onTime = returns ? (onTimeReturns * 100 / returns) : 0;
      var onTimeRatio = document.getElementById("reportOnTimeRatio");
      if (onTimeRatio) onTimeRatio.innerHTML = onTime.toFixed(1) + ' <span class="unit">%</span>';
      var categories = document.getElementById("reportCategories");
      if (categories) categories.innerHTML = stats.categoryStats.length ? stats.categoryStats.map(function (item) {
        return '<tr><td>' + escape(item.category) + '</td><td>' + item.title_count + '</td><td>' + item.copies + '</td><td>' + item.borrowed + '</td></tr>';
      }).join("") : '<tr><td colspan="4" class="table-empty">Chưa có dữ liệu.</td></tr>';
      var topBooks = document.getElementById("reportTopBooks");
      if (topBooks) topBooks.innerHTML = stats.topBooks.length ? stats.topBooks.map(function (item) {
        return '<tr><td>' + escape(item.name) + '</td><td>' + escape(item.code) + '</td><td>' + item.loan_count + '</td></tr>';
      }).join("") : '<tr><td colspan="3" class="table-empty">Chưa có dữ liệu mượn.</td></tr>';
      if (document.getElementById("reportTopic")) applyTopic();
    } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
  }
  function dateOnly(date) { return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"); }
  function applyReportPeriod(period) {
    var now = new Date(), from = new Date(now), to = new Date(now);
    if (period === "week") { from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); }
    else if (period === "month") { from.setDate(1); }
    else if (period === "quarter") { from.setMonth(Math.floor(now.getMonth() / 3) * 3, 1); }
    else if (period === "year") { from.setMonth(0, 1); }
    reportRange = { from: dateOnly(from), to: dateOnly(to) };
    document.getElementById("reportFrom").value = reportRange.from;
    document.getElementById("reportTo").value = reportRange.to;
    loadStats(reportRange);
  }
  function applyTopic() {
    if (!reportStats) return;
    var topic = document.getElementById("reportTopic").value;
    var label = document.querySelector("#reportFinesMonth")?.closest(".admin-stat-card")?.querySelector(".admin-stat-label");
    var value = document.getElementById("reportFinesMonth");
    var foot = value?.closest(".admin-stat-card")?.querySelector(".admin-stat-foot");
    var loansValue = document.getElementById("reportLoansMonth");
    if (topic === "fines") {
      label.textContent = "TIỀN PHẠT / BỒI THƯỜNG GHI NHẬN TRONG KỲ";
      value.innerHTML = Number(reportStats.finesInPeriod ?? reportStats.lateFinesThisMonth).toLocaleString("vi-VN") + ' <span class="unit">đ</span>';
      foot.textContent = "Tổng khoản phạt và bồi thường đã ghi nhận trong khoảng thời gian.";
      loansValue.closest(".admin-stat-card").querySelector(".admin-stat-label").textContent = "KHOẢN CHƯA THANH TOÁN TRONG KỲ";
      loansValue.innerHTML = Number(reportStats.unpaidFinesInPeriod ?? reportStats.unpaidFines).toLocaleString("vi-VN") + ' <span class="unit">đ</span>';
    } else if (topic === "circulation") {
      label.textContent = "LƯỢT MƯỢN GHI NHẬN TRONG KỲ";
      value.innerHTML = escape(reportStats.loansInPeriod ?? reportStats.loansThisMonth) + ' <span class="unit">lượt</span>';
      foot.textContent = "Thống kê theo ngày tạo phiếu mượn.";
      loansValue.closest(".admin-stat-card").querySelector(".admin-stat-label").textContent = "ĐẦU SÁCH ĐƯỢC THEO DÕI";
      loansValue.innerHTML = escape(reportStats.books) + ' <span class="unit">đầu sách</span>';
    } else if (topic === "returns") {
      label.textContent = "LƯỢT TRẢ ĐÚNG HẠN TRONG KỲ";
      value.innerHTML = escape(reportStats.onTimeReturnsInPeriod ?? reportStats.onTimeReturns) + ' <span class="unit">lượt</span>';
      foot.textContent = "Đối chiếu thời điểm trả với hạn trả của từng phiếu.";
      loansValue.closest(".admin-stat-card").querySelector(".admin-stat-label").textContent = "LƯỢT TRẢ TRONG KỲ";
      loansValue.innerHTML = escape(reportStats.returnsInPeriod ?? reportStats.totalReturns) + ' <span class="unit">lượt</span>';
    } else {
      label.textContent = "GIÁ TRỊ NHẬP KHO TRONG KỲ";
      value.innerHTML = Number(reportStats.receiptValueInPeriod || 0).toLocaleString("vi-VN") + ' <span class="unit">đ</span>';
      foot.textContent = "Tổng giá trị theo các phiếu nhập kho trong khoảng ngày.";
      loansValue.closest(".admin-stat-card").querySelector(".admin-stat-label").textContent = "LƯỢT XUẤT KHO TRONG KỲ";
      loansValue.innerHTML = escape(reportStats.exportsInPeriod || 0) + ' <span class="unit">phiếu</span>';
    }
  }
  function init() {
    var overviewButtons = document.querySelectorAll("[data-overview-period]");
    overviewButtons.forEach(function (button) { button.addEventListener("click", function () {
      overviewButtons.forEach(function (item) { item.classList.toggle("active", item === button); });
      var now = new Date(), from = new Date(now);
      if (button.dataset.overviewPeriod === "week") from.setDate(now.getDate() - 6);
      else if (button.dataset.overviewPeriod === "month") from.setDate(1);
      loadStats({ from: dateOnly(from), to: dateOnly(now) });
    }); });
    var reportButtons = document.querySelectorAll("[data-report-period]");
    reportButtons.forEach(function (button) { button.addEventListener("click", function () {
      reportButtons.forEach(function (item) { item.classList.toggle("active", item === button); });
      applyReportPeriod(button.dataset.reportPeriod);
    }); });
    var fromInput = document.getElementById("reportFrom"), toInput = document.getElementById("reportTo");
    if (fromInput && toInput) {
      fromInput.addEventListener("change", function () { reportRange.from = fromInput.value; reportRange.to = toInput.value; loadStats(reportRange); });
      toInput.addEventListener("change", function () { reportRange.from = fromInput.value; reportRange.to = toInput.value; loadStats(reportRange); });
    }
    var topic = document.getElementById("reportTopic");
    if (topic) topic.addEventListener("change", applyTopic);
    if (topic) applyReportPeriod("month");
    else loadStats();
    var exportButton = document.getElementById("reportsExportExcel");
    var pdfButton = document.getElementById("reportsExportPdf");
    if (exportButton) exportButton.addEventListener("click", exportReport);
    if (pdfButton) pdfButton.addEventListener("click", function () { global.print(); });
    if (auditTable) {
      document.getElementById("reloadAudit").addEventListener("click", loadAudit);
      auditSearch.addEventListener("input", loadAudit);
      loadAudit();
    }
    if (backupTable) {
      document.getElementById("reloadBackups").addEventListener("click", loadBackups);
      backupTable.addEventListener("click", async function (event) {
        var button = event.target.closest("[data-restore-backup]");
        if (!button || !global.confirm("Khôi phục " + button.dataset.restoreBackup + "? Dữ liệu hiện tại sẽ được sao lưu trước.")) return;
        button.disabled = true;
        try {
          await api("/api/backups/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: button.dataset.restoreBackup }) });
          global.alert("Đã khôi phục dữ liệu. Hãy đăng nhập lại.");
          location.replace("/x%C3%A1c-th%E1%BB%B1c/giao%20di%E1%BB%87n/dang-nhap.html");
        } catch (error) { button.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
      });
      document.getElementById("createBackup").addEventListener("click", async function (event) {
        var button = event.currentTarget; button.disabled = true;
        try { await api("/api/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); await loadBackups(); await loadSettings(); global.MocThu.thanhPhan.hienThongBao("Đã tạo bản sao lưu."); }
        catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
        finally { button.disabled = false; }
      });
      backupForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          await api("/api/backup-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: backupForm.elements.enabled.checked, intervalDays: backupForm.elements.intervalDays.value }) });
          await loadSettings(); global.MocThu.thanhPhan.hienThongBao("Đã lưu lịch sao lưu.");
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
      });
      loadBackups(); loadSettings();
    }
  }
  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyHeThong = { khoiTao: init };
}(window));
