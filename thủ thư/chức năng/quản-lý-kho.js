(function (global) {
  "use strict";

  var api = global.MocThu.auth.request;
  var books = [];
  var copies = [];
  var table = document.getElementById("warehouseTable");

  function esc(value) { return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value); }

  function updateLocations() {
    var select = document.getElementById("warehouseLocationFilter");
    if (!select) return;
    var current = select.value;
    var locations = Array.from(new Set(copies.map(function (copy) { return copy.location; }).filter(Boolean))).sort();
    select.innerHTML = '<option value="all">Tất cả vị trí kệ kho</option>' + locations.map(function (location) {
      return '<option value="' + esc(location) + '">' + esc(location) + '</option>';
    }).join("");
    if (locations.includes(current)) select.value = current;
  }

  function render() {
    if (!table) return;
    var query = (document.getElementById("warehouseSearch")?.value || "").trim().toLocaleLowerCase("vi");
    var location = document.getElementById("warehouseLocationFilter")?.value || "all";
    var status = document.getElementById("warehouseStatusFilter")?.value || "all";
    var rows = books.filter(function (book) {
      var bookCopies = copies.filter(function (copy) { return copy.book_id === book.id; });
      var available = bookCopies.filter(function (copy) { return copy.status === "available"; }).length;
      var damaged = bookCopies.filter(function (copy) { return copy.status === "damaged"; }).length;
      var locations = Array.from(new Set(bookCopies.map(function (copy) { return copy.location; }).filter(Boolean)));
      var text = [book.code, book.name, book.author, book.location, locations.join(" "), book.quality].join(" ").toLocaleLowerCase("vi");
      var matchStatus = status === "all" ||
        (status === "low" && available <= Number(book.minimum || 0)) ||
        (status === "damaged" && damaged > 0) ||
        (status === "available" && available > 0);
      return text.includes(query) && (location === "all" || locations.includes(location)) && matchStatus;
    });

    table.innerHTML = rows.length ? rows.map(function (book) {
      var bookCopies = copies.filter(function (copy) { return copy.book_id === book.id; });
      var available = bookCopies.filter(function (copy) { return copy.status === "available"; }).length;
      var loaned = bookCopies.filter(function (copy) { return copy.status === "loaned"; }).length;
      var damaged = bookCopies.filter(function (copy) { return copy.status === "damaged"; }).length;
      var retired = bookCopies.filter(function (copy) { return copy.status === "retired"; }).length;
      var need = available <= Number(book.minimum || 0);
      return '<tr><td><strong class="tx-code">' + esc(book.code) + '</strong><br><small>' + bookCopies.length + ' mã bản sao</small></td>' +
        '<td><strong>' + esc(book.name) + '</strong><br><small>' + esc(book.author) + '</small></td>' +
        '<td>' + esc(book.location || "Chưa xếp kệ") + '</td>' +
        '<td><strong>' + Number(book.stock || 0) + '</strong></td><td>' + loaned + '</td><td>' + Number(book.minimum || 0) + '</td>' +
        '<td><span class="badge ' + (damaged ? 'warning' : 'success') + '">' + esc(book.quality || "Tốt") + '</span>' + (damaged ? '<br><small>' + damaged + ' bản hư hỏng</small>' : '') + '</td>' +
        '<td>' + (need ? '<span class="badge danger">Cần nhập (' + available + ' sẵn sàng)</span>' : '<span class="badge">Đủ lượng · ' + available + ' sẵn sàng</span>') +
        (retired ? '<br><small>' + retired + ' bản đã thanh lý</small>' : '') + '</td></tr>';
    }).join("") : '<tr><td class="table-empty" colspan="8">Không có đầu sách phù hợp với bộ lọc.</td></tr>';

    var totalCopies = copies.filter(function (copy) { return ["available", "loaned", "reserved"].includes(copy.status); }).length;
    var onLoan = copies.filter(function (copy) { return copy.status === "loaned"; }).length;
    var damaged = copies.filter(function (copy) { return copy.status === "damaged" || copy.status === "retired"; }).length;
    var low = books.filter(function (book) {
      return copies.filter(function (copy) { return copy.book_id === book.id && copy.status === "available"; }).length <= Number(book.minimum || 0);
    }).length;
    [["warehouseTotalCopies", totalCopies], ["warehouseLoanedCopies", onLoan], ["warehouseDamagedCopies", damaged], ["warehouseLowBooks", low]].forEach(function (entry) {
      var node = document.getElementById(entry[0]);
      if (node) node.textContent = Number(entry[1]).toLocaleString("vi-VN");
    });
  }

  async function load() {
    if (!table) return;
    try {
      var result = await Promise.all([api("/api/books"), api("/api/copies")]);
      books = result[0].books || [];
      copies = result[1].copies || [];
      updateLocations();
      render();
    } catch (error) {
      table.innerHTML = '<tr><td class="table-empty" colspan="8">' + esc(error.message) + '</td></tr>';
    }
  }

  function init() {
    ["warehouseSearch", "warehouseLocationFilter", "warehouseStatusFilter"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.addEventListener(id === "warehouseSearch" ? "input" : "change", render);
    });
    var showLow = document.getElementById("warehouseShowLow");
    if (showLow) showLow.addEventListener("click", function () {
      var status = document.getElementById("warehouseStatusFilter");
      if (status) status.value = "low";
      render();
      var target = document.getElementById("copy-inventory");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    var tabs = document.getElementById("warehouse-movements");
    if (tabs) tabs.addEventListener("click", function (event) {
      var button = event.target.closest("[data-wh-target]");
      if (!button) return;
      tabs.querySelectorAll("[data-wh-target]").forEach(function (item) { item.classList.toggle("active", item === button); });
      var target = document.getElementById(button.dataset.whTarget);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    load();
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyKho = { khoiTao: init, locBang: render, taiKho: load };
}(window));
