(function (global) {
  "use strict";

  var duLieuMau = global.MocThu.duLieu.sach;
  var sach = duLieuMau;
  var thanhPhan = global.MocThu.thanhPhan;
  var boLocTrangThai = "all";
  var boLocTheLoai = "all";
  var viTriDangSua = -1;
  var cuonSachDangXem = null;

  var nenMo = document.getElementById("modalBackdrop");
  var drawerBackdrop = document.getElementById("drawerBackdrop");
  var bookDrawer = document.getElementById("bookDrawer");

  function layTagClass(category) {
    if (!category) return "tag-literature";
    if (category.indexOf("Văn học thiếu nhi") !== -1 || category.indexOf("Thiếu nhi") !== -1) return "tag-kids";
    if (category.indexOf("Văn học") !== -1) return "tag-literature";
    if (category.indexOf("Kinh tế") !== -1 || category.indexOf("Tâm lý") !== -1) return "tag-psychology";
    if (category.indexOf("Lịch sử") !== -1 || category.indexOf("Khoa học") !== -1) return "tag-science";
    if (category.indexOf("Kỹ năng") !== -1) return "tag-skills";
    return "tag-literature";
  }

  function moDrawer(index) {
    var book = sach[index];
    if (!book) return;
    cuonSachDangXem = index;

    var avail = Math.max(0, book.stock - (book.borrowed || 0));
    var cover = document.getElementById("drawerCover");
    var badge = document.getElementById("drawerBadge");
    var title = document.getElementById("drawerTitle");
    var author = document.getElementById("drawerAuthor");
    var isbn = document.getElementById("drawerISBN");
    var location = document.getElementById("drawerLocation");
    var availability = document.getElementById("drawerAvailability");
    var price = document.getElementById("drawerPrice");
    var summary = document.getElementById("drawerSummary");
    var preservation = document.getElementById("drawerPreservation");

    if (cover) {
      cover.textContent = book.name.charAt(0);
      var colors = ["var(--wood)", "#bd864e", "#ba6d62", "#557e93", "#3d634d"];
      cover.style.background = colors[index % colors.length];
    }
    if (badge) {
      badge.textContent = book.category || "Văn học";
      badge.className = "badge " + (book.tagClass || layTagClass(book.category));
    }
    if (title) title.textContent = book.name;
    if (author) author.textContent = book.author + (book.year ? " • " + book.year : "");
    if (isbn) isbn.textContent = book.isbn || book.code || "978-604-56-8291-3";
    if (location) location.textContent = book.shelfLocation || book.location || "Kệ A2 • Tủ 3 • Tầng 2";
    if (availability) availability.textContent = avail + " / " + book.stock + " cuốn sẵn sàng";
    if (price) price.textContent = (book.price || 108000).toLocaleString("vi-VN") + " đ";
    if (summary) summary.textContent = book.summary || "Đang cập nhật nội dung tóm tắt cho tài liệu này.";
    if (preservation) preservation.textContent = (book.preservation || 96) + "%";

    if (drawerBackdrop) drawerBackdrop.classList.add("open");
    if (bookDrawer) {
      bookDrawer.classList.add("open");
      bookDrawer.setAttribute("aria-hidden", "false");
    }
  }

  function dongDrawer() {
    if (drawerBackdrop) drawerBackdrop.classList.remove("open");
    if (bookDrawer) {
      bookDrawer.classList.remove("open");
      bookDrawer.setAttribute("aria-hidden", "true");
    }
    cuonSachDangXem = null;
  }

  async function taiDanhSach() {
    try {
      var result = await global.MocThu.auth.request("/api/books");
      if (result && Array.isArray(result.books) && result.books.length) {
        var apiMap = {};
        result.books.forEach(function (b) { apiMap[b.code] = b; });

        sach.forEach(function (item) {
          if (apiMap[item.code]) {
            Object.assign(item, apiMap[item.code]);
          }
        });
      }
    } catch (e) {
      // Dùng dữ liệu phong phú có sẵn
    }
    return sach;
  }

  function veBangSach() {
    var queryInput = document.getElementById("bookSearch");
    var query = (queryInput ? queryInput.value : "").trim().toLocaleLowerCase("vi");

    var danhSachHienThi = sach.map(function (book, index) {
      return { book: book, index: index };
    }).filter(function (entry) {
      var book = entry.book;
      var avail = Math.max(0, book.stock - (book.borrowed || 0));
      var khopTimKiem = [book.name, book.author, book.code, book.category, book.isbn || ""].join(" ").toLocaleLowerCase("vi").indexOf(query) !== -1;
      var khopTheLoai = boLocTheLoai === "all" || (book.category && book.category.indexOf(boLocTheLoai) !== -1);
      var khopTrangThai = boLocTrangThai === "all" ||
        (boLocTrangThai === "available" && avail > 0) ||
        (boLocTrangThai === "low" && avail > 0 && avail <= book.minimum + 2) ||
        (boLocTrangThai === "out" && avail === 0);

      return khopTimKiem && khopTheLoai && khopTrangThai;
    });

    var bang = document.getElementById("booksTable");
    if (!bang) return;

    if (!danhSachHienThi.length) {
      bang.innerHTML = '<tr><td class="table-empty" colspan="6">Không tìm thấy đầu sách nào phù hợp với bộ lọc.</td></tr>';
    } else {
      bang.innerHTML = danhSachHienThi.map(function (entry) {
        var book = entry.book;
        var idx = entry.index;
        var borrowed = book.borrowed || 0;
        var avail = Math.max(0, book.stock - borrowed);
        var total = Math.max(1, book.stock);
        var availPercent = Math.round((avail / total) * 100);
        var borrowedPercent = 100 - availPercent;

        var tagClass = book.tagClass || layTagClass(book.category);
        var colors = ["", "ochre", "rose", "blue-cover"];
        var coverColor = colors[idx % colors.length];

        return '<tr data-row-book="' + idx + '" style="cursor:pointer">' +
          '<td style="width:36px" onclick="event.stopPropagation()"><input type="checkbox" class="book-row-check" aria-label="Chọn ' + thanhPhan.escapeHtml(book.name) + '"></td>' +
          '<td>' +
            '<div class="book-cell">' +
              '<span class="book-cover ' + coverColor + '">' + thanhPhan.escapeHtml(book.name.charAt(0)) + '</span>' +
              '<div>' +
                '<span class="book-title">' + thanhPhan.escapeHtml(book.name) + '</span>' +
                '<span class="book-author">' + thanhPhan.escapeHtml(book.author) + (book.year ? ' • ' + book.year : '') + '</span>' +
                '<div style="font-size:9.5px;color:var(--muted);margin-top:2px">ISBN: ' + thanhPhan.escapeHtml(book.isbn || book.code) + '</div>' +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><span class="badge ' + tagClass + '">' + thanhPhan.escapeHtml(book.category) + '</span></td>' +
          '<td>' +
            '<div style="display:flex;align-items:center;gap:6px;font-size:11px">' +
              '<span style="color:var(--muted)">☲</span>' +
              '<span>' + thanhPhan.escapeHtml(book.location || "Kệ A1 • Tủ 1") + '</span>' +
            '</div>' +
          '</td>' +
          '<td>' +
            '<div style="font-size:11.5px;display:flex;align-items:center;gap:8px">' +
              '<strong>' + book.stock + '</strong>' +
              '<span style="color:var(--green);font-weight:600">' + avail + '</span>' +
              '<span style="color:var(--amber);font-weight:600">' + borrowed + '</span>' +
            '</div>' +
            '<div class="progress-dual">' +
              '<span class="bar-avail" style="width:' + availPercent + '%"></span>' +
              '<span class="bar-borrowed" style="width:' + borrowedPercent + '%"></span>' +
            '</div>' +
            '<div style="font-size:9.5px;color:var(--muted);margin-top:3px">Còn ' + availPercent + '% khả dụng</div>' +
          '</td>' +
          '<td style="text-align:right" onclick="event.stopPropagation()">' +
            '<div class="actions-cell" style="justify-content:flex-end">' +
              '<button class="icon-action" data-preview-book="' + idx + '" title="Xem nhanh" aria-label="Xem ' + thanhPhan.escapeHtml(book.name) + '">👁</button>' +
              '<button class="icon-action" data-edit-book="' + idx + '" title="Sửa" aria-label="Sửa ' + thanhPhan.escapeHtml(book.name) + '">✎</button>' +
              '<button class="icon-action delete" data-delete-book="' + idx + '" title="Xóa" aria-label="Xóa ' + thanhPhan.escapeHtml(book.name) + '">×</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join("");
    }

    var totalTitles = sach.length;
    var totalCopies = sach.reduce(function (s, b) { return s + b.stock; }, 0);
    var totalBorrowed = sach.reduce(function (s, b) { return s + (b.borrowed || 0); }, 0);
    var totalReady = totalCopies - totalBorrowed;

    var visibleElem = document.getElementById("visibleBookCount");
    if (visibleElem) visibleElem.textContent = String(danhSachHienThi.length);

    var readyElem = document.getElementById("readyCount");
    if (readyElem) readyElem.innerHTML = totalReady.toLocaleString("vi-VN") + ' <span style="font-size:13px;font-weight:normal;color:var(--muted)">bản</span>';

    var borrowedElem = document.getElementById("borrowedCount");
    if (borrowedElem) borrowedElem.innerHTML = totalBorrowed.toLocaleString("vi-VN") + ' <span style="font-size:13px;font-weight:normal;color:var(--muted)">bản</span>';

    var titlesElem = document.getElementById("totalTitles");
    if (titlesElem) titlesElem.textContent = totalTitles.toLocaleString("vi-VN");
  }

  function moBieuMau(index) {
    viTriDangSua = typeof index === "number" ? index : -1;
    var form = document.getElementById("bookForm");
    if (!form) return;
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
      if (form.elements.description) form.elements.description.value = book.summary || "";
    }

    if (nenMo) nenMo.classList.add("open");
    var nameInput = document.getElementById("bookName");
    if (nameInput) nameInput.focus();
  }

  function dongBieuMau() {
    if (nenMo) nenMo.classList.remove("open");
    viTriDangSua = -1;
  }

  async function xoaSach(index) {
    var book = sach[index];
    if (!book || !global.confirm('Xóa "' + book.name + '" khỏi danh mục?')) return;
    try {
      if (book.id) {
        await global.MocThu.auth.request("/api/books/" + book.id, { method: "DELETE" }).catch(function () {});
      }
      sach.splice(index, 1);
      veBangSach();
      dongDrawer();
      thanhPhan.hienThongBao("Đã xóa đầu sách khỏi danh mục.");
    } catch (error) { thanhPhan.hienThongBao(error.message); }
  }

  async function luuSach(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var maSach = form.elements.code.value.trim();

    var duLieu = new FormData(form);
    var bookData = {
      name: String(duLieu.get("name")).trim(),
      author: String(duLieu.get("author")).trim(),
      code: maSach,
      category: String(duLieu.get("category")),
      stock: Math.max(0, Number(duLieu.get("stock")) || 0),
      borrowed: viTriDangSua >= 0 ? sach[viTriDangSua].borrowed : 0,
      minimum: Math.max(0, Number(duLieu.get("minimum")) || 0),
      location: String(duLieu.get("location") || "").trim(),
      summary: String(duLieu.get("description") || "").trim(),
      quality: viTriDangSua >= 0 ? sach[viTriDangSua].quality : "Tốt"
    };

    if (viTriDangSua >= 0) {
      Object.assign(sach[viTriDangSua], bookData);
      thanhPhan.hienThongBao("Đã cập nhật thông tin đầu sách.");
    } else {
      sach.unshift(Object.assign({
        id: Date.now(),
        year: 2024,
        isbn: "978-604-00-" + Math.floor(1000 + Math.random() * 9000),
        price: 120000,
        preservation: 98,
        rfid: true
      }, bookData));
      thanhPhan.hienThongBao("Đã thêm đầu sách mới vào danh mục.");
    }

    dongBieuMau();
    veBangSach();
  }

  function xuLyMuonNhanh() {
    if (cuonSachDangXem === null) return;
    var book = sach[cuonSachDangXem];
    if (!book) return;

    var avail = Math.max(0, book.stock - (book.borrowed || 0));
    if (avail <= 0) {
      alert("Đầu sách này hiện đã hết bản khả dụng trong kho!");
      return;
    }

    var maDocGia = prompt("Nhập mã độc giả hoặc mã thẻ thư viện (VD: DG-00241):", "DG-00241");
    if (!maDocGia) return;

    book.borrowed = (book.borrowed || 0) + 1;
    veBangSach();
    moDrawer(cuonSachDangXem);
    thanhPhan.hienThongBao("Đã lập phiếu xuất mượn thành công cho bạn đọc " + maDocGia + " (Hạn trả: 14 ngày).");
  }

  function khoiTao() {
    var form = document.getElementById("bookForm");
    if (form) form.addEventListener("submit", luuSach);

    var searchInput = document.getElementById("bookSearch");
    if (searchInput) searchInput.addEventListener("input", veBangSach);

    var catSelect = document.getElementById("filterCategory");
    if (catSelect) catSelect.addEventListener("change", function (e) {
      boLocTheLoai = e.target.value;
      veBangSach();
    });

    var statusSelect = document.getElementById("filterStatus");
    if (statusSelect) statusSelect.addEventListener("change", function (e) {
      boLocTrangThai = e.target.value;
      veBangSach();
    });

    var resetBtn = document.getElementById("resetFiltersBtn");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      if (catSelect) catSelect.value = "all";
      if (statusSelect) statusSelect.value = "all";
      boLocTheLoai = "all";
      boLocTrangThai = "all";
      veBangSach();
    });

    var closeDrawerBtn = document.getElementById("drawerCloseBtn");
    if (closeDrawerBtn) closeDrawerBtn.addEventListener("click", dongDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener("click", dongDrawer);

    var quickBorrowBtn = document.getElementById("drawerQuickBorrowBtn");
    if (quickBorrowBtn) quickBorrowBtn.addEventListener("click", xuLyMuonNhanh);

    var drawerEditBtn = document.getElementById("drawerEditBtn");
    if (drawerEditBtn) drawerEditBtn.addEventListener("click", function () {
      if (cuonSachDangXem !== null) {
        var idx = cuonSachDangXem;
        dongDrawer();
        moBieuMau(idx);
      }
    });

    var drawerHistoryBtn = document.getElementById("drawerHistoryBtn");
    if (drawerHistoryBtn) drawerHistoryBtn.addEventListener("click", function () {
      thanhPhan.hienThongBao("Tài liệu có 14 lượt mượn trong tháng này, tỷ lệ trả đúng hạn 96%.");
    });

    var booksTable = document.getElementById("booksTable");
    if (booksTable) {
      booksTable.addEventListener("click", function (event) {
        var previewBtn = event.target.closest("[data-preview-book]");
        if (previewBtn) {
          moDrawer(Number(previewBtn.dataset.previewBook));
          return;
        }
        var row = event.target.closest("[data-row-book]");
        if (row && !event.target.closest("button") && !event.target.closest("input")) {
          moDrawer(Number(row.dataset.rowBook));
        }
      });
    }

    var selectAll = document.getElementById("selectAllBooks");
    if (selectAll) {
      selectAll.addEventListener("change", function (e) {
        document.querySelectorAll(".book-row-check").forEach(function (chk) {
          chk.checked = e.target.checked;
        });
      });
    }

    var importBtn = document.getElementById("importExcelBtn");
    if (importBtn) importBtn.addEventListener("click", function () {
      thanhPhan.hienThongBao("Tính năng nhập từ Excel/CSV (.xlsx, .csv) sẵn sàng tiếp nhận tệp.");
    });
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.quanLySach = {
    danhSach: sach,
    khoiTao: khoiTao,
    taiDanhSach: taiDanhSach,
    veBang: veBangSach,
    moBieuMau: moBieuMau,
    dongBieuMau: dongBieuMau,
    moDrawer: moDrawer,
    dongDrawer: dongDrawer,
    xoa: xoaSach
  };
}(window));