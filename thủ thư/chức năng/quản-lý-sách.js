(function (global) {
  "use strict";

  var duLieuMau = global.MocThu.duLieu.sach;
  var sach = duLieuMau;
  var thanhPhan = global.MocThu.thanhPhan;
  var boLocTrangThai = "all";
  var boLocTheLoai = "all";
  var boLocNgonNgu = "all";
  var viTriDangSua = -1;
  var cuonSachDangXem = null;

  function soBanSanSang(book) {
    return Math.max(0, Number(book.available_copies ?? (book.stock - (book.borrowed || 0))));
  }

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

  function layAnhBia(book) {
    var entries = global.MocThu.biaSach && global.MocThu.biaSach.covers || [];
    var normalized = String(book.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
    var match = entries.find(function (entry) {
      var title = String(entry.title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
      return normalized.indexOf(title) === 0 || title.indexOf(normalized) === 0;
    });
    if (match) return match.image;
    return "https://covers.openlibrary.org/b/title/" + encodeURIComponent(book.name || "book") + "-M.jpg?default=false";
  }

  function ganAnhBia(container, book) {
    if (!container || !book) return;
    var image = document.createElement("img");
    image.className = "catalog-cover-image";
    image.alt = "Bìa sách " + book.name;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.src = layAnhBia(book);
    image.addEventListener("error", function () {
      image.remove();
      container.classList.add("cover-fallback");
      if (!container.textContent.trim()) container.textContent = String(book.name || "?").charAt(0);
    });
    image.addEventListener("load", function () { container.classList.add("has-cover"); });
    container.appendChild(image);
  }

  function moDrawer(index) {
    var book = sach[index];
    if (!book) return;
    cuonSachDangXem = index;

    var avail = soBanSanSang(book);
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
      cover.replaceChildren();
      ganAnhBia(cover, book);
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
      if (result && Array.isArray(result.books)) {
        sach.splice.apply(sach, [0, sach.length].concat(result.books));
        var categorySelect = document.getElementById("filterCategory");
        if (categorySelect) {
          var selected = categorySelect.value;
          var categories = Array.from(new Set(sach.map(function (book) { return book.category; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, "vi"); });
          categorySelect.innerHTML = '<option value="all">Tất cả thể loại</option>' + categories.map(function (category) {
            return '<option value="' + thanhPhan.escapeHtml(category) + '">' + thanhPhan.escapeHtml(category) + '</option>';
          }).join("");
          categorySelect.value = categories.includes(selected) ? selected : "all";
        }
      }
    } catch (error) {
      console.warn("Không thể tải danh mục sách từ máy chủ:", error);
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
      var avail = soBanSanSang(book);
      var khopTimKiem = [book.name, book.author, book.code, book.category, book.isbn || ""].join(" ").toLocaleLowerCase("vi").indexOf(query) !== -1;
      var khopTheLoai = boLocTheLoai === "all" || book.category === boLocTheLoai;
      var khopNgonNgu = boLocNgonNgu === "all" || (book.language || "vi") === boLocNgonNgu;
      var khopTrangThai = boLocTrangThai === "all" ||
        (boLocTrangThai === "available" && avail > 0) ||
        (boLocTrangThai === "low" && avail > 0 && avail <= book.minimum + 2) ||
        (boLocTrangThai === "out" && avail === 0);

      return khopTimKiem && khopTheLoai && khopTrangThai && khopNgonNgu;
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
        var avail = soBanSanSang(book);
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
              '<span class="book-cover ' + coverColor + '" data-book-cover="' + idx + '">' + thanhPhan.escapeHtml(book.name.charAt(0)) + '</span>' +
              '<div>' +
                '<span class="book-title">' + thanhPhan.escapeHtml(book.name) + '</span>' +
                '<span class="book-author">' + thanhPhan.escapeHtml(book.author) + (book.year ? ' • ' + book.year : '') + '</span>' +
                '<div style="font-size:9.5px;color:var(--muted);margin-top:2px">ISBN: ' + thanhPhan.escapeHtml(book.isbn || book.code) + ' · ' + ((book.language || "vi") === "en" ? "Tiếng Anh" : "Tiếng Việt") + '</div>' +
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
      danhSachHienThi.forEach(function (entry) {
        ganAnhBia(bang.querySelector('[data-book-cover="' + entry.index + '"]'), entry.book);
      });
    }

    var totalTitles = sach.length;
    var totalCopies = sach.reduce(function (s, b) { return s + b.stock; }, 0);
    var totalBorrowed = sach.reduce(function (s, b) { return s + (b.borrowed || 0); }, 0);
    var totalReady = sach.reduce(function (sum, book) { return sum + soBanSanSang(book); }, 0);

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
      if (form.elements.language) form.elements.language.value = book.language || "vi";
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
    if (!book.id) {
      thanhPhan.hienThongBao("Đầu sách chưa có mã lưu trong cơ sở dữ liệu.");
      return;
    }
    try {
      await global.MocThu.auth.request("/api/books/" + book.id, { method: "DELETE" });
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
      language: String(duLieu.get("language") || "vi"),
      stock: Math.max(0, Number(duLieu.get("stock")) || 0),
      borrowed: viTriDangSua >= 0 ? sach[viTriDangSua].borrowed : 0,
      minimum: Math.max(0, Number(duLieu.get("minimum")) || 0),
      location: String(duLieu.get("location") || "").trim(),
      summary: String(duLieu.get("description") || "").trim(),
      quality: viTriDangSua >= 0 ? sach[viTriDangSua].quality : "Tốt"
    };

    try {
      var editingBook = viTriDangSua >= 0 ? sach[viTriDangSua] : null;
      var result = await global.MocThu.auth.request(
        editingBook ? "/api/books/" + editingBook.id : "/api/books",
        {
          method: editingBook ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookData)
        }
      );
      if (editingBook) {
        Object.assign(editingBook, result.book);
      } else {
        sach.unshift(result.book);
      }
      dongBieuMau();
      veBangSach();
      thanhPhan.hienThongBao(editingBook ? "Đã cập nhật thông tin đầu sách." : "Đã thêm đầu sách mới vào danh mục.");
    } catch (error) {
      thanhPhan.hienThongBao(error.message);
    }
  }

  function xuLyMuonNhanh() {
    if (cuonSachDangXem === null) return;
    var book = sach[cuonSachDangXem];
    if (!book || !book.id) {
      thanhPhan.hienThongBao("Đầu sách chưa được tải từ cơ sở dữ liệu.");
      return;
    }

    var avail = soBanSanSang(book);
    if (avail <= 0) {
      thanhPhan.hienThongBao("Đầu sách này hiện đã hết bản khả dụng trong kho.");
      return;
    }

    if (global.MocThu.quanLyNghiepVu) global.MocThu.quanLyNghiepVu.moPhieuMuon(book.id);
  }

  function docCsv(text) {
    var rows = [], row = [], cell = "", quoted = false;
    for (var i = 0; i < text.length; i += 1) {
      var char = text[i];
      if (quoted && char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i += 1;
        row.push(cell); cell = "";
        if (row.some(function (value) { return value.trim(); })) rows.push(row);
        row = [];
      } else cell += char;
    }
    row.push(cell);
    if (row.some(function (value) { return value.trim(); })) rows.push(row);
    if (rows.length < 2) throw new Error("Tệp CSV chưa có dòng dữ liệu.");
    var aliases = { "tên sách": "name", "tên đầu sách": "name", "tác giả": "author", "mã sách": "code", "thể loại": "category", "ngôn ngữ": "language", "số lượng": "stock", "tồn kho": "stock", "tồn tối thiểu": "minimum", "vị trí": "location", "mô tả": "summary" };
    var headers = rows.shift().map(function (value) {
      var key = value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase("vi");
      return aliases[key] || key;
    });
    if (!headers.includes("name") || !headers.includes("author") || !headers.includes("code")) {
      throw new Error("CSV cần có cột name, author, code (hoặc Tên sách, Tác giả, Mã sách).");
    }
    return rows.map(function (values) {
      var item = {};
      headers.forEach(function (header, index) { item[header] = (values[index] || "").trim(); });
      return {
        name: item.name, author: item.author, code: item.code,
        category: item.category || "Khác", language: item.language === "en" ? "en" : "vi",
        stock: Number(item.stock || 0), borrowed: 0, minimum: Number(item.minimum || 0),
        location: item.location || "", summary: item.summary || "", quality: "Tốt"
      };
    }).filter(function (item) { return item.name && item.author && item.code; });
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

    var languageSelect = document.getElementById("filterLang");
    if (languageSelect) languageSelect.addEventListener("change", function (e) {
      boLocNgonNgu = e.target.value;
      veBangSach();
    });

    var resetBtn = document.getElementById("resetFiltersBtn");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      if (catSelect) catSelect.value = "all";
      if (statusSelect) statusSelect.value = "all";
      if (languageSelect) languageSelect.value = "all";
      boLocTheLoai = "all";
      boLocTrangThai = "all";
      boLocNgonNgu = "all";
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
    if (drawerHistoryBtn) drawerHistoryBtn.addEventListener("click", async function () {
      if (cuonSachDangXem == null || !sach[cuonSachDangXem]) return;
      drawerHistoryBtn.disabled = true;
      try {
        var result = await global.MocThu.auth.request("/api/books/" + sach[cuonSachDangXem].id + "/history");
        var history = result.loans.length ? result.loans.map(function (loan) {
          return (loan.reader_name || loan.reader_code) + " · " + new Date(loan.borrowed_at).toLocaleDateString("vi-VN") + " · " +
            (loan.returned_at ? "Đã trả" : "Hạn " + new Date(loan.due_at).toLocaleDateString("vi-VN"));
        }).join("\n") : "Chưa có lịch sử mượn.";
        global.alert(history);
      } catch (error) { thanhPhan.hienThongBao(error.message); }
      finally { drawerHistoryBtn.disabled = false; }
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
    var importFile = document.getElementById("bookImportFile");
    if (importBtn && importFile) importBtn.addEventListener("click", function () { importFile.click(); });
    if (importFile) importFile.addEventListener("change", async function () {
      var file = importFile.files && importFile.files[0];
      if (!file) return;
      importBtn.disabled = true;
      try {
        var records = docCsv(await file.text());
        if (!records.length) throw new Error("Không tìm thấy dòng sách hợp lệ.");
        var added = 0, errors = [];
        for (var i = 0; i < records.length; i += 1) {
          try {
            await global.MocThu.auth.request("/api/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(records[i]) });
            added += 1;
          } catch (error) { errors.push(records[i].code + ": " + error.message); }
        }
        await taiDanhSach(); veBangSach();
        thanhPhan.hienThongBao("Đã nhập " + added + "/" + records.length + " đầu sách." + (errors.length ? " Một số dòng lỗi: " + errors.slice(0, 3).join("; ") : ""));
      } catch (error) { thanhPhan.hienThongBao(error.message); }
      finally { importBtn.disabled = false; importFile.value = ""; }
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
