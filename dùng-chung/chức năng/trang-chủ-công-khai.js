(function () {
  "use strict";
  var catalog = document.getElementById("publicBookCatalog");
  var search = document.getElementById("publicBookSearch");
  var authorSearch = document.getElementById("publicAuthorSearch");
  var categoryFilter = document.getElementById("publicCategoryFilter");
  var availableOnly = document.getElementById("publicAvailableOnly");
  var books = [];
  var currentUser = null;
  var loginUrl = "x%C3%A1c-th%E1%BB%B1c/giao%20di%E1%BB%87n/dang-nhap.html?role=reader";
  function escape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function render() {
    var query = search.value.trim().toLocaleLowerCase("vi");
    var author = authorSearch.value.trim().toLocaleLowerCase("vi");
    var category = categoryFilter.value;
    var matches = books.filter(function (book) {
      return [book.name, book.author, book.category, book.code].join(" ").toLocaleLowerCase("vi").includes(query) &&
        (!author || book.author.toLocaleLowerCase("vi").includes(author)) && (!category || book.category === category) &&
        (!availableOnly.checked || book.stock > book.borrowed);
    });
    catalog.innerHTML = matches.length ? matches.map(function (book) {
      return '<article style="padding:18px;background:#fbfaf5;border:1px solid #dfddcf;border-radius:6px">' +
        '<div style="font-size:11px;color:#6f8064;font-weight:700">' + escape(book.category) + '</div>' +
        '<h3 style="font:600 20px \'Playfair Display\',serif;margin:8px 0">' + escape(book.name) + '</h3>' +
        '<p style="color:#70766e;margin:0 0 8px">' + escape(book.author) + '</p>' +
        '<p style="font-size:12px;color:#70766e">' + (Math.max(0, book.stock - book.borrowed) ? 'Còn ' + Math.max(0, book.stock - book.borrowed) + ' bản' : 'Tạm hết') + '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-book-action="reserve" data-book-id="' + book.id + '" style="background:#254b3a;color:white;padding:10px 14px;border:0;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer">Đặt sách</button>' +
        '<button type="button" data-book-action="detail" style="background:transparent;color:#254b3a;padding:10px 14px;border:1px solid #bdc6b9;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer">Chi tiết</button></div></article>';
    }).join("") : '<p>Không tìm thấy sách phù hợp.</p>';
  }
  search.addEventListener("input", render);
  authorSearch.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);
  availableOnly.addEventListener("change", render);
  catalog.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-book-action]");
    if (!button) return;
    if (!currentUser) { location.href = loginUrl; return; }
    if (currentUser.role !== "reader") { location.href = currentUser.role === "admin" ? "qu%E1%BA%A3n%20l%C3%AD/giao%20di%E1%BB%87n/trang-ch%E1%BB%A7.html" : "th%E1%BB%A7%20th%C6%B0/giao%20di%E1%BB%87n/trang-ch%E1%BB%A7.html"; return; }
    if (button.dataset.bookAction === "detail") {
      var book = books.find(function (item) { return String(item.id) === button.dataset.bookId; });
      if (book) window.alert((book.summary || "Chưa có mô tả cho sách này.") + "\n\nMã sách: " + book.code + " · Vị trí: " + (book.location || "Chưa cập nhật"));
      return;
    }
    button.disabled = true;
    try {
      var response = await fetch("/api/reservations", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookId: Number(button.dataset.bookId) }) });
      var result = await response.json().catch(function () { return {}; });
      if (response.status === 401) { location.href = loginUrl; return; }
      if (!response.ok) throw new Error(result.error || "Không thể đặt sách.");
      button.textContent = "Đã gửi yêu cầu";
    } catch (error) { window.alert(error.message); }
    finally { button.disabled = false; }
  });
  fetch("/api/session", { credentials: "same-origin" }).then(function (response) {
    if (!response.ok) return null;
    return response.json();
  }).then(function (result) { currentUser = result && result.user; });
  fetch("/api/books", { credentials: "same-origin" }).then(function (response) {
    if (!response.ok) throw new Error("catalog");
    return response.json();
  }).then(function (result) { books = result.books || []; render(); }).catch(function () {
    catalog.innerHTML = "<p>Chưa tải được danh mục sách. Vui lòng thử tải lại trang.</p>";
  });
}());
