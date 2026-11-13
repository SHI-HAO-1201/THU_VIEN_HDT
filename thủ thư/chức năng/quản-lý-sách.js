(function (global) {
  "use strict";

  var sach = global.MocThu.duLieu.sach;
  var thanhPhan = global.MocThu.thanhPhan;
  var boLoc = "all";
  var viTriDangSua = -1;
  var nenMo = document.getElementById("modalBackdrop");

  function tinhTrangSach(book) {
    if (book.stock <= book.minimum) return '<span class="badge danger">Cần bổ sung</span>';
    if (book.stock <= book.minimum + 2) return '<span class="badge warning">Sắp hết</span>';
    return '<span class="badge">Còn sách</span>';
  }

  async function taiDanhSach() {
    var result = await global.MocThu.auth.request("/api/books");
    sach.splice(0, sach.length, ...result.books.map(function (book) {
      return { id: book.id, name: book.name, author: book.author, code: book.code, category: book.category,
        stock: book.stock, borrowed: book.borrowed, minimum: book.minimum, location: book.location, quality: book.quality };
    }));
    return sach;
  }

  function veBangSach() {
    var query = (document.getElementById("bookSearch").value || "").trim().toLocaleLowerCase("vi");
    var danhSachHienThi = sach.map(function (book, index) {
      return { book: book, index: index };
    }).filter(function (entry) {
      var book = entry.book;
      var khopTimKiem = [book.name, book.author, book.code, book.category].join(" ").toLocaleLowerCase("vi").indexOf(query) !== -1;
      var khopBoLoc = boLoc === "all" || (boLoc === "available" && book.stock > 0) || (boLoc === "low" && book.stock <= book.minimum + 2);
      return khopTimKiem && khopBoLoc;
    });
    var bang = document.getElementById("booksTable");

    if (!danhSachHienThi.length) {
      bang.innerHTML = '<tr><td class="table-empty" colspan="7">Không tìm thấy đầu sách phù hợp.</td></tr>';
    } else {
      bang.innerHTML = danhSachHienThi.map(function (entry) {
        var book = entry.book;
        var phanTramTon = Math.min(100, Math.round(book.stock / Math.max(book.minimum * 3, 1) * 100));
        var mauBia = entry.index % 4 === 1 ? "ochre" : (entry.index % 4 === 2 ? "rose" : (entry.index % 4 === 3 ? "blue-cover" : ""));
        return '<tr><td><div class="book-cell"><span class="book-cover ' + mauBia + '">' + thanhPhan.escapeHtml(book.name.charAt(0)) + '</span><span><span class="book-title">' + thanhPhan.escapeHtml(book.name) + '</span><span class="book-author">' + thanhPhan.escapeHtml(book.author) + '</span></span></div></td><td><strong>' + thanhPhan.escapeHtml(book.code) + '</strong></td><td>' + thanhPhan.escapeHtml(book.category) + '</td><td><strong>' + book.stock + '</strong><div class="progress"><span style="width:' + phanTramTon + '%"></span></div></td><td>' + book.minimum + '</td><td>' + tinhTrangSach(book) + '</td><td><div class="actions-cell"><button class="icon-action" data-edit-book="' + entry.index + '" aria-label="Sửa ' + thanhPhan.escapeHtml(book.name) + '">✎</button><button class="icon-action delete" data-delete-book="' + entry.index + '" aria-label="Xóa ' + thanhPhan.escapeHtml(book.name) + '">×</button></div></td></tr>';
      }).join("");
    }

    document.getElementById("visibleBookCount").textContent = String(danhSachHienThi.length);
    document.getElementById("totalCopies").textContent = String(sach.reduce(function (sum, book) { return sum + book.stock; }, 0));
    var soDauSach = sach.length.toLocaleString("vi-VN");
    document.getElementById("booksCount").textContent = soDauSach;
    var statTitles = document.getElementById("statTitles");
    if (statTitles) statTitles.textContent = soDauSach;
    var bannerBookCount = document.getElementById("bannerBookCount");
    if (bannerBookCount) bannerBookCount.textContent = soDauSach;
    var warehouseTotal = document.getElementById("warehouseTotal");
    if (warehouseTotal) warehouseTotal.textContent = (4750 + sach.reduce(function (sum, book) { return sum + book.stock; }, 0)).toLocaleString("vi-VN");
  }

  function moBieuMau(index) {
    viTriDangSua = typeof index === "number" ? index : -1;
    var form = document.getElementById("bookForm");
    form.reset();
    document.getElementById("modalTitle").textContent = viTriDangSua < 0 ? "Thêm đầu sách" : "Chỉnh sửa đầu sách";

    if (viTriDangSua >= 0) {
      var book = sach[viTriDangSua];
      form.elements.name.value = book.name;
      form.elements.author.value = book.author;
      form.elements.code.value = book.code;
      form.elements.category.value = book.category;
      form.elements.stock.value = book.stock;
      form.elements.minimum.value = book.minimum;
      form.elements.location.value = book.location || "";
    }

    nenMo.classList.add("open");
    document.getElementById("bookName").focus();
  }

  function dongBieuMau() {
    nenMo.classList.remove("open");
    viTriDangSua = -1;
  }

  async function xoaSach(index) {
    var book = sach[index];
    if (!book || !global.confirm('Xóa "' + book.name + '" khỏi danh mục?')) return;
    try {
      await global.MocThu.auth.request("/api/books/" + book.id, { method: "DELETE" });
      await taiDanhSach();
      veBangSach();
      thanhPhan.hienThongBao("Đã xóa đầu sách khỏi danh mục.");
    } catch (error) { thanhPhan.hienThongBao(error.message); }
  }

  async function luuSach(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var maSach = form.elements.code.value.trim();
    var trungMa = sach.some(function (book, index) {
      return book.code.toLocaleLowerCase("vi") === maSach.toLocaleLowerCase("vi") && index !== viTriDangSua;
    });

    if (trungMa) {
      form.elements.code.setCustomValidity("Mã tài liệu này đã tồn tại.");
      form.elements.code.reportValidity();
      form.elements.code.addEventListener("input", function xoaLoiMa() {
        form.elements.code.setCustomValidity("");
        form.elements.code.removeEventListener("input", xoaLoiMa);
      });
      return;
    }

    var duLieu = new FormData(form);
    var book = {
      name: String(duLieu.get("name")).trim(),
      author: String(duLieu.get("author")).trim(),
      code: maSach,
      category: String(duLieu.get("category")),
      stock: Math.max(0, Number(duLieu.get("stock")) || 0),
      borrowed: viTriDangSua >= 0 ? sach[viTriDangSua].borrowed : 0,
      minimum: Math.max(0, Number(duLieu.get("minimum")) || 0),
      location: String(duLieu.get("location") || "").trim(),
      quality: viTriDangSua >= 0 ? sach[viTriDangSua].quality : "Tốt"
    };

    try {
      await global.MocThu.auth.request(viTriDangSua >= 0 ? "/api/books/" + sach[viTriDangSua].id : "/api/books", {
        method: viTriDangSua >= 0 ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book)
      });
      thanhPhan.hienThongBao(viTriDangSua >= 0 ? "Đã cập nhật thông tin đầu sách." : "Đã thêm đầu sách mới vào danh mục.");
      dongBieuMau();
      await taiDanhSach();
      veBangSach();
    } catch (error) { thanhPhan.hienThongBao(error.message); }

  }

  function khoiTao() {
    document.getElementById("bookForm").addEventListener("submit", luuSach);
    document.getElementById("bookSearch").addEventListener("input", veBangSach);
    document.getElementById("bookFilters").addEventListener("click", function (event) {
      var button = event.target.closest("[data-filter]");
      if (!button) return;
      boLoc = button.dataset.filter;
      document.querySelectorAll("#bookFilters .filter-button").forEach(function (filter) {
        filter.classList.toggle("active", filter === button);
      });
      veBangSach();
    });
  }

  global.MocThu.quanLySach = {
    danhSach: sach,
    khoiTao: khoiTao,
    taiDanhSach: taiDanhSach,
    veBang: veBangSach,
    moBieuMau: moBieuMau,
    dongBieuMau: dongBieuMau,
    xoa: xoaSach
  };
}(window));
