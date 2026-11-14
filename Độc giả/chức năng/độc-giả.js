(function (global) {
  "use strict";
  var books = [];
  var grid = document.getElementById("readerCatalogGrid");
  var input = document.getElementById("readerSearch");

  function filterCatalog() {
    if (!grid) return;
    var query = input ? input.value.trim().toLocaleLowerCase("vi") : "";
    grid.querySelectorAll(".reader-book-card").forEach(function (card) {
      card.hidden = card.textContent.toLocaleLowerCase("vi").indexOf(query) === -1;
    });
  }

  async function khoiTao() {
    if (input) input.addEventListener("input", filterCatalog);
    if (!grid) return;
    var result = await global.MocThu.auth.request("/api/books");
    books = result.books;
    grid.innerHTML = books.map(function (book, index) {
      var cover = index % 4 ? " cover-" + (index % 4 + 1) : "";
      var remaining = Math.max(0, book.stock - book.borrowed);
      return '<article class="reader-book-card"><div class="reader-book-cover' + cover + '">' + global.MocThu.thanhPhan.escapeHtml(book.name) + '</div>' +
        '<div class="reader-book-info"><h3>' + global.MocThu.thanhPhan.escapeHtml(book.name) + '</h3>' +
        '<p>' + global.MocThu.thanhPhan.escapeHtml(book.author) + ' · ' + global.MocThu.thanhPhan.escapeHtml(book.category) + '</p>' +
        '<div class="reader-book-meta"><span>' + (remaining ? 'Còn ' + remaining + ' bản' : 'Đang hết bản') + '</span>' +
        '<button data-borrow' + (remaining ? '' : ' disabled') + '>Đặt trước</button></div></div></article>';
    }).join("");
    if (global.MocThu.biaSach) global.MocThu.biaSach.enhance(grid);
    filterCatalog();
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.docGia = { khoiTao: khoiTao };
}(window));
