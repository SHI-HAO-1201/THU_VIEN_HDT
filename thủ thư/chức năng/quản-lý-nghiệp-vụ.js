(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var supplierForm = document.getElementById("supplierForm");
  var suppliersTable = document.getElementById("suppliersTable");
  var receiptForm = document.getElementById("receiptForm");
  var exportForm = document.getElementById("exportForm");
  var copiesTable = document.getElementById("copiesTable");
  var finesTable = document.getElementById("finesTable");
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
  function init() {
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
  global.MocThu.quanLyNghiepVu = { khoiTao: init, taiPhieuNhap: loadReceipts, taiPhieuXuat: loadExports };
}(window));
