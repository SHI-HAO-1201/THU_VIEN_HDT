(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var supplierForm = document.getElementById("supplierForm");
  var suppliersTable = document.getElementById("suppliersTable");
  var receiptForm = document.getElementById("receiptForm");
  var exportForm = document.getElementById("exportForm");
  var copiesTable = document.getElementById("copiesTable");
  var finesTable = document.getElementById("finesTable");
  var loanForm = document.getElementById("loanForm");
  var returnForm = document.getElementById("returnForm");
  var state = { suppliers: [], books: [], copies: [], fines: [] };
  function esc(value) { return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value); }
  function renderSuppliers() {
    if (!suppliersTable) return;
    var query = document.getElementById("supplierSearch").value.trim().toLocaleLowerCase("vi");
    var rows = state.suppliers.filter(function (item) { return [item.name, item.contact_name, item.email, item.phone, item.address].join(" ").toLocaleLowerCase("vi").includes(query); });
    suppliersTable.innerHTML = rows.length ? rows.map(function (item) {
      return '<tr><td><strong>' + esc(item.name) + '</strong></td><td>' + esc(item.contact_name) + '</td><td>' + esc(item.email) + '</td><td>' + esc(item.phone) + '</td><td>' + esc(item.address) + '</td><td>' + (item.status === "active" ? "Hoạt động" : "Đã khóa") + '</td><td><button class="button small soft" data-supplier-action="edit" data-supplier-id="' + item.id + '">Sửa</button> <button class="button small soft" data-supplier-action="toggle" data-supplier-id="' + item.id + '" data-status="' + (item.status === "active" ? "disabled" : "active") + '">' + (item.status === "active" ? "Khóa" : "Mở") + '</button> <button class="button small soft" data-supplier-action="delete" data-supplier-id="' + item.id + '">Xóa</button></td></tr>';
    }).join("") : '<tr><td colspan="7" class="table-empty">Chưa có nhà cung cấp phù hợp.</td></tr>';
    var select = document.getElementById("receiptSupplier");
    if (select) select.innerHTML = '<option value="">Chọn nhà cung cấp</option>' + state.suppliers.filter(function (item) { return item.status === "active"; }).map(function (item) { return '<option value="' + item.id + '">' + esc(item.name) + '</option>'; }).join("");
  }
  async function loadSuppliers() {
    if (!suppliersTable && !receiptForm) return;
    try { state.suppliers = (await api("/api/suppliers")).suppliers || []; renderSuppliers(); }
    catch (error) { if (suppliersTable) suppliersTable.innerHTML = '<tr><td colspan="7" class="table-empty">' + esc(error.message) + '</td></tr>'; }
  }
  async function loadBooks() {
    if (!receiptForm) return;
    try {
      state.books = (await api("/api/books")).books || [];
      document.getElementById("receiptBook").innerHTML = '<option value="">Chọn đầu sách</option>' + state.books.map(function (book) { return '<option value="' + book.id + '">' + esc(book.name) + ' · ' + esc(book.code) + '</option>'; }).join("");
      state.copies = (await api("/api/copies")).copies || [];
      renderCopies();
      document.getElementById("exportCopy").innerHTML = '<option value="">Chọn bản sao</option>' + state.copies.filter(function (copy) { return copy.status === "available" || copy.status === "damaged"; }).map(function (copy) { return '<option value="' + copy.id + '">' + esc(copy.barcode) + ' · ' + esc(copy.book_name) + ' · ' + esc(copy.status) + '</option>'; }).join("");
    } catch (error) { if (copiesTable) copiesTable.innerHTML = '<tr><td colspan="6" class="table-empty">' + esc(error.message) + '</td></tr>'; }
  }
  function renderCopies() {
    if (!copiesTable) return;
    var query = document.getElementById("copySearch").value.trim().toLocaleLowerCase("vi");
    var labels = { available: "Sẵn sàng", loaned: "Đang mượn", reserved: "Đang giữ chỗ", damaged: "Hư hỏng", retired: "Thanh lý" };
      var rows = state.copies.filter(function (copy) { return [copy.barcode, copy.book_name || copy.bookName, copy.location, copy.condition, labels[copy.status]].join(" ").toLocaleLowerCase("vi").includes(query); });
    copiesTable.innerHTML = rows.length ? rows.map(function (copy) {
      var action = '<button class="button small soft" data-print-copy="' + copy.id + '">In nhãn</button> ' +
        (copy.status === "damaged" ? '<button class="button small soft" data-repair-copy="' + copy.id + '">Đánh dấu đã sửa</button>' : "");
      return '<tr><td><strong>' + esc(copy.barcode) + '</strong></td><td>' + esc(copy.book_name || copy.bookName) + '</td><td>' + esc(copy.location) + '</td><td>' + esc(copy.condition) + '</td><td>' + (labels[copy.status] || esc(copy.status)) + '</td><td>' + action + '</td></tr>';
    }).join("") : '<tr><td colspan="6" class="table-empty">Chưa có bản sao phù hợp.</td></tr>';
  }
  async function loadReceipts() {
    var table = document.getElementById("receiptsTable");
    if (!table) return;
    try {
      var result = await api("/api/receipts");
      table.innerHTML = result.receipts.length ? result.receipts.map(function (r) {
        return '<tr><td><strong>' + esc(r.receipt_code) + '</strong></td><td>' + esc(r.supplier_name) + '</td><td>' + new Date(r.received_at).toLocaleDateString("vi-VN") + '</td><td>' + r.total_quantity + '</td><td>' + Number(r.total_cost).toLocaleString("vi-VN") + ' đ</td><td>' + esc(r.created_by_name) + '</td></tr>';
      }).join("") : '<tr><td colspan="6" class="table-empty">Chưa có phiếu nhập.</td></tr>';
    } catch (error) { table.innerHTML = '<tr><td colspan="6" class="table-empty">' + esc(error.message) + '</td></tr>'; }
  }
  async function loadExports() {
    var table = document.getElementById("exportsTable");
    if (!table) return;
    try {
      var result = await api("/api/exports");
      table.innerHTML = result.exports.length ? result.exports.map(function (r) {
        return '<tr><td><strong>' + esc(r.export_code) + '</strong></td><td>' + new Date(r.exported_at).toLocaleDateString("vi-VN") + '</td><td>' + r.copy_count + '</td><td>' + esc(r.reason) + '</td><td>' + esc(r.created_by_name) + '</td></tr>';
      }).join("") : '<tr><td colspan="5" class="table-empty">Chưa có phiếu xuất.</td></tr>';
    } catch (error) { table.innerHTML = '<tr><td colspan="5" class="table-empty">' + esc(error.message) + '</td></tr>'; }
  }
  async function loadFines() {
    if (!finesTable) return;
    try {
      var result = await api("/api/fines"); state.fines = result.fines || [];
      finesTable.innerHTML = state.fines.length ? state.fines.map(function (f) {
        var status = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", waived: "Đã miễn" }[f.status] || f.status;
        return '<tr><td>' + esc(f.reader_name || f.reader_code) + '</td><td>' + esc(f.book_name) + '</td><td>' + esc(f.reason) + '</td><td>' + Number(f.amount).toLocaleString("vi-VN") + ' đ</td><td>' + status + '</td><td>' + new Date(f.created_at).toLocaleDateString("vi-VN") + '</td><td>' + (f.status === "unpaid" ? '<button class="button small" data-settle-fine="' + f.id + '">Đã thu</button>' : "—") + '</td></tr>';
      }).join("") : '<tr><td colspan="7" class="table-empty">Chưa có khoản phạt hoặc bồi thường.</td></tr>';
    } catch (error) { finesTable.innerHTML = '<tr><td colspan="7" class="table-empty">' + esc(error.message) + '</td></tr>'; }
  }
  function toggle(form) { if (!form) return; form.hidden = !form.hidden; form.style.display = form.hidden ? "none" : "grid"; }

  function closeDialog(id) {
    var backdrop = document.getElementById(id);
    if (backdrop) backdrop.classList.remove("open");
  }

  async function openLoanDialog(bookId) {
    if (!loanForm) return;
    var readerSelect = document.getElementById("loanReaderCode");
    var bookSelect = document.getElementById("loanBookId");
    readerSelect.innerHTML = '<option value="">Đang tải thẻ…</option>';
    bookSelect.innerHTML = '<option value="">Đang tải sách…</option>';
    document.getElementById("loanModalBackdrop").classList.add("open");
    try {
      var result = await Promise.all([api("/api/readers"), api("/api/books"), api("/api/copies")]);
      var readers = (result[0].readers || []).filter(function (reader) {
        return reader.status === "active" && reader.card_status === "active" && reader.card_code;
      });
      var availableCounts = {};
      (result[2].copies || []).forEach(function (copy) {
        if (copy.status === "available") availableCounts[copy.book_id] = (availableCounts[copy.book_id] || 0) + 1;
      });
      var books = (result[1].books || []).filter(function (book) { return availableCounts[book.id] > 0; });
      readerSelect.innerHTML = '<option value="">Chọn thẻ độc giả</option>' + readers.map(function (reader) {
        return '<option value="' + esc(reader.card_code) + '">' + esc(reader.full_name) + ' · ' + esc(reader.card_code) + '</option>';
      }).join("");
      bookSelect.innerHTML = '<option value="">Chọn đầu sách</option>' + books.map(function (book) {
        return '<option value="' + book.id + '">' + esc(book.name) + ' · còn ' + availableCounts[book.id] + ' bản</option>';
      }).join("");
      if (bookId && books.some(function (book) { return String(book.id) === String(bookId); })) bookSelect.value = String(bookId);
      if (!readers.length) readerSelect.innerHTML = '<option value="">Chưa có thẻ độc giả hoạt động</option>';
      if (!books.length) bookSelect.innerHTML = '<option value="">Không còn bản sẵn sàng</option>';
      bookSelect.focus();
    } catch (error) {
      closeDialog("loanModalBackdrop");
      global.MocThu.thanhPhan.hienThongBao(error.message);
    }
  }

  function openReturnDialog(loanId) {
    if (!returnForm) return;
    var row = document.querySelector('#loansTable tr[data-loan-id="' + loanId + '"]');
    document.getElementById("returnLoanSummary").textContent = row ? row.cells[1].textContent.replace(/\s+/g, " · ").trim() : "Kiểm tra tình trạng sách khi nhận trả.";
    returnForm.elements.loanId.value = loanId;
    returnForm.elements.condition.value = "normal";
    document.getElementById("compensationField").hidden = true;
    document.getElementById("returnModalBackdrop").classList.add("open");
    document.getElementById("returnCondition").focus();
  }

  function init() {
    var newLoanButton = document.getElementById("newLoanButton");
    if (newLoanButton) newLoanButton.addEventListener("click", function (event) {
      event.stopPropagation();
      openLoanDialog();
    });
    if (loanForm) loanForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var submit = loanForm.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        var payload = Object.fromEntries(new FormData(loanForm).entries());
        payload.bookId = Number(payload.bookId);
        var result = await api("/api/loans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        closeDialog("loanModalBackdrop");
        loanForm.reset();
        await Promise.all([global.MocThu.dieuHuong.taiPhieuMuon(), loadBooks(), global.MocThu.quanLyKho && global.MocThu.quanLyKho.taiKho()]);
        global.MocThu.thanhPhan.hienThongBao("Đã tạo phiếu mượn " + result.loan.id + " · hạn trả " + new Date(result.loan.dueAt).toLocaleDateString("vi-VN") + ".");
      } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
      finally { submit.disabled = false; }
    });
    document.querySelectorAll("[data-close-loan]").forEach(function (button) { button.addEventListener("click", function () { closeDialog("loanModalBackdrop"); }); });
    var loanBackdrop = document.getElementById("loanModalBackdrop");
    if (loanBackdrop) loanBackdrop.addEventListener("click", function (event) { if (event.target === loanBackdrop) closeDialog("loanModalBackdrop"); });

    var conditionSelect = document.getElementById("returnCondition");
    if (conditionSelect) conditionSelect.addEventListener("change", function () {
      var required = conditionSelect.value !== "normal";
      document.getElementById("compensationField").hidden = !required;
      returnForm.elements.compensationAmount.required = required;
    });
    var loansTable = document.getElementById("loansTable");
    if (loansTable) loansTable.addEventListener("click", function (event) {
      var button = event.target.closest("[data-return-loan]");
      if (!button) return;
      event.stopPropagation();
      openReturnDialog(button.dataset.returnLoan);
    });
    if (returnForm) returnForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var submit = returnForm.querySelector('[type="submit"]');
      submit.disabled = true;
      var condition = returnForm.elements.condition.value;
      var compensationAmount = condition === "normal" ? 0 : Number(returnForm.elements.compensationAmount.value);
      try {
        var result = await api("/api/loans/" + returnForm.elements.loanId.value + "/return", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ damaged: condition === "damaged", lost: condition === "lost", compensationAmount: compensationAmount })
        });
        closeDialog("returnModalBackdrop");
        await Promise.all([global.MocThu.dieuHuong.taiPhieuMuon(), loadBooks(), loadFines(), global.MocThu.quanLyKho && global.MocThu.quanLyKho.taiKho()]);
        global.MocThu.thanhPhan.hienThongBao(result.totalDue ? "Đã nhận trả. Cần xử lý " + result.totalDue.toLocaleString("vi-VN") + "đ tiền phạt/bồi thường." : "Đã nhận trả sách và cập nhật tồn kho.");
      } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
      finally { submit.disabled = false; }
    });
    document.querySelectorAll("[data-close-return]").forEach(function (button) { button.addEventListener("click", function () { closeDialog("returnModalBackdrop"); }); });
    var returnBackdrop = document.getElementById("returnModalBackdrop");
    if (returnBackdrop) returnBackdrop.addEventListener("click", function (event) { if (event.target === returnBackdrop) closeDialog("returnModalBackdrop"); });

    if (supplierForm) {
      document.getElementById("toggleSupplierForm").addEventListener("click", function () { toggle(supplierForm); });
      document.getElementById("supplierSearch").addEventListener("input", renderSuppliers);
      document.getElementById("reloadSuppliers").addEventListener("click", loadSuppliers);
      suppliersTable.addEventListener("click", async function (event) {
        var button = event.target.closest("[data-supplier-action]"); if (!button) return;
        var id = button.dataset.supplierId; button.disabled = true;
        try {
          if (button.dataset.supplierAction === "toggle") {
            await api("/api/suppliers/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.status }) });
          } else if (button.dataset.supplierAction === "delete") {
            if (!global.confirm("Xóa nhà cung cấp này?")) return;
            await api("/api/suppliers/" + id, { method: "DELETE" });
          } else {
            var current = state.suppliers.find(function (x) { return String(x.id) === id; });
            var name = global.prompt("Tên nhà cung cấp", current.name); if (name === null) return;
            var phone = global.prompt("Điện thoại", current.phone); if (phone === null) return;
            await api("/api/suppliers/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, phone: phone }) });
          }
          await loadSuppliers();
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
        finally { button.disabled = false; }
      });
      supplierForm.addEventListener("submit", async function (event) {
        event.preventDefault(); var button = supplierForm.querySelector('[type="submit"]'); button.disabled = true;
        try { await api("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(supplierForm).entries())) }); supplierForm.reset(); toggle(supplierForm); await loadSuppliers(); global.MocThu.thanhPhan.hienThongBao("Đã thêm nhà cung cấp."); }
        catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); } finally { button.disabled = false; }
      });
    }
    if (receiptForm) {
      document.getElementById("newReceiptButton").addEventListener("click", function () { toggle(receiptForm); receiptForm.scrollIntoView({ behavior: "smooth", block: "center" }); });
      document.getElementById("newExportButton").addEventListener("click", function () { toggle(exportForm); exportForm.scrollIntoView({ behavior: "smooth", block: "center" }); });
      document.getElementById("reloadReceipts").addEventListener("click", loadReceipts);
      document.getElementById("reloadExports").addEventListener("click", loadExports);
      document.getElementById("copySearch").addEventListener("input", renderCopies);
      receiptForm.addEventListener("submit", async function (event) {
        event.preventDefault(); var button = receiptForm.querySelector('[type="submit"]'); button.disabled = true;
        var data = Object.fromEntries(new FormData(receiptForm).entries());
        try {
          var result = await api("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId: data.supplierId, note: data.note, items: [{ bookId: data.bookId, quantity: data.quantity, unitCost: data.unitCost }] }) });
          receiptForm.reset(); toggle(receiptForm); await Promise.all([loadBooks(), loadReceipts()]); global.MocThu.thanhPhan.hienThongBao("Đã lập phiếu " + result.receiptCode + " và tạo mã vạch.");
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); } finally { button.disabled = false; }
      });
      exportForm.addEventListener("submit", async function (event) {
        event.preventDefault(); var button = exportForm.querySelector('[type="submit"]'); button.disabled = true;
        var data = Object.fromEntries(new FormData(exportForm).entries());
        try {
          var result = await api("/api/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: data.reason, items: [{ copyId: data.copyId, action: data.action }] }) });
          exportForm.reset(); toggle(exportForm); await Promise.all([loadBooks(), loadExports()]); global.MocThu.thanhPhan.hienThongBao("Đã lập phiếu xuất " + result.exportCode + ".");
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); } finally { button.disabled = false; }
      });
      copiesTable.addEventListener("click", async function (event) {
        var printButton = event.target.closest("[data-print-copy]");
        if (printButton) {
          var copy = state.copies.find(function (item) { return String(item.id) === printButton.dataset.printCopy; });
          if (!copy) return;
          var printWindow = global.open("", "_blank", "width=420,height=320");
          if (!printWindow) { global.MocThu.thanhPhan.hienThongBao("Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại."); return; }
          printWindow.document.write('<!doctype html><html lang="vi"><meta charset="utf-8"><title>Nhãn mã vạch</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:30px}.label{border:1px solid #333;padding:24px}.code{font-size:24px;font-weight:bold;letter-spacing:2px}.barcode{font-family:monospace;font-size:42px;letter-spacing:3px;margin:14px 0}</style><div class="label"><strong>' + esc(copy.book_name) + '</strong><div class="barcode">|||| ||| || ||||</div><div class="code">' + esc(copy.barcode) + '</div><div>' + esc(copy.location) + '</div></div><script>window.onload=function(){window.print()}<\/script></html>');
          printWindow.document.close();
          return;
        }
        var button = event.target.closest("[data-repair-copy]"); if (!button) return; button.disabled = true;
        try { await api("/api/copies/" + button.dataset.repairCopy, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "available", condition: "Đã sửa chữa" }) }); await loadBooks(); }
        catch (error) { button.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
      });
      loadSuppliers(); loadBooks(); loadReceipts(); loadExports();
    }
    if (finesTable) {
      document.getElementById("reloadFines").addEventListener("click", loadFines);
      finesTable.addEventListener("click", async function (event) {
        var button = event.target.closest("[data-settle-fine]"); if (!button || !global.confirm("Xác nhận đã thu khoản tiền này?")) return; button.disabled = true;
        try { await api("/api/fines/" + button.dataset.settleFine + "/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); await Promise.all([loadFines(), loadBooks()]); }
        catch (error) { button.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
      });
      loadFines();
    }
  }
  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyNghiepVu = { khoiTao: init, taiPhieuNhap: loadReceipts, taiPhieuXuat: loadExports, moPhieuMuon: openLoanDialog, moNhanTra: openReturnDialog };
}(window));
