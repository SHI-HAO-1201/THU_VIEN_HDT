(function (global) {
  "use strict";
  var books = [];
  var grid = document.getElementById("readerCatalogGrid");
  var input = document.getElementById("readerSearch");
  var categoryFilter = document.getElementById("readerCategoryFilter");
  var availableOnly = document.getElementById("readerAvailableOnly");
  var heroInput = document.getElementById("userHeroSearch");

  function filterCatalog() {
    if (!grid) return;
    var query = input ? input.value.trim().toLocaleLowerCase("vi") : "";
    grid.querySelectorAll(".reader-book-card").forEach(function (card) {
      var book = books.find(function (item) { return card.dataset.bookId === String(item.id); });
      var matches = card.textContent.toLocaleLowerCase("vi").indexOf(query) !== -1 &&
        (!categoryFilter || !categoryFilter.value || (book && book.category === categoryFilter.value)) &&
        (!availableOnly || !availableOnly.checked || (book && Number(book.available_copies ?? (book.stock - book.borrowed)) > 0));
      card.hidden = !matches;
    });
  }

  async function loadProfile() {
    var form = document.getElementById("readerProfileForm");
    if (!form) return;
    try {
      var result = await global.MocThu.auth.request("/api/profile");
      form.elements.fullName.value = result.profile.full_name || "";
      form.elements.email.value = result.profile.email || "";
      var username = document.getElementById("readerUsername");
      var joined = document.getElementById("readerCreatedAt");
      var card = document.getElementById("readerProfileCard");
      var cardStatus = document.getElementById("readerProfileStatus");
      var expiry = document.getElementById("readerProfileExpiry");
      if (username) username.value = result.profile.username || "";
      if (joined) joined.value = result.profile.created_at ? new Date(result.profile.created_at).toLocaleDateString("vi-VN") : "";
      if (card) card.textContent = result.profile.card_code || "Chưa cấp thẻ";
      if (cardStatus) cardStatus.textContent = result.profile.card_status === "active" ? "Thẻ đang hoạt động" : "Thẻ chưa hoạt động";
      if (expiry) expiry.textContent = result.profile.expires_at ? new Date(result.profile.expires_at).toLocaleDateString("vi-VN") : "—";
      var headerName = document.getElementById("topUserName");
      if (headerName) headerName.textContent = result.profile.full_name;
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          var updated = await global.MocThu.auth.request("/api/profile", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
          });
          if (headerName) headerName.textContent = updated.fullName;
          global.MocThu.thanhPhan.hienThongBao("Đã cập nhật hồ sơ độc giả.");
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
        finally { submit.disabled = false; }
      });
    } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
  }

  async function loadHistory() {
    var container = document.getElementById("readerHistoryList");
    var loansContainer = document.getElementById("readerLoansList");
    var reservationsContainer = document.getElementById("readerReservationsList");
    if (!container && !loansContainer && !reservationsContainer) return;
    try {
      var result = await global.MocThu.auth.request("/api/reader/history");
      var openLoans = result.loans.filter(function (loan) { return !loan.returned_at; });
      var activeReservations = result.reservations.filter(function (item) { return item.status === "pending"; });
      var loanCount = document.getElementById("readerLoanCount");
      var reservationCount = document.getElementById("readerReservationCount");
      if (loanCount) loanCount.textContent = String(openLoans.length);
      if (reservationCount) reservationCount.textContent = String(activeReservations.length);
      var loanEntries = result.loans.map(function (loan) {
        var due = new Date(loan.due_at);
        var overdue = !loan.returned_at && due.getTime() < Date.now();
        return '<article class="reader-record"><div><h3>' + global.MocThu.thanhPhan.escapeHtml(loan.book_name) + '</h3>' +
          '<p>Mã phiếu PM-' + String(loan.id).padStart(5, "0") + ' · Mượn ngày ' + new Date(loan.borrowed_at).toLocaleDateString("vi-VN") +
          ' · Hạn trả ' + due.toLocaleDateString("vi-VN") + (loan.returned_at ? ' · Đã trả ngày ' + new Date(loan.returned_at).toLocaleDateString("vi-VN") : '') + '</p></div>' +
          '<div><span class="reader-status" style="' + (overdue ? 'background:#fbebea;color:#a13c35' : '') + '">' + (loan.returned_at ? "Đã trả" : (overdue ? "Quá hạn" : "Đang mượn")) + '</span>' +
          (loan.returned_at ? "" : ' <button class="button small soft" type="button" data-reader-renew="' + loan.id + '">Gia hạn 7 ngày</button>') + '</div></article>';
      });
      var reservationEntries = result.reservations.map(function (item) {
        var labels = { pending: "Đang chờ", fulfilled: "Đã nhận", cancelled: "Đã hủy" };
        return '<article class="reader-record"><div><h3>' + global.MocThu.thanhPhan.escapeHtml(item.book_name) + '</h3><p>' + (labels[item.status] || item.status) +
          (item.expires_at ? ' · Giữ đến ' + new Date(item.expires_at).toLocaleDateString("vi-VN") : " · Đang chờ bản có sẵn") +
          '</p></div>' + (item.status === "pending" ? '<button class="button small soft" type="button" data-cancel-reservation="' + item.id + '">Hủy yêu cầu</button>' : '<span class="reader-status">' + (labels[item.status] || item.status) + '</span>') + '</article>';
      });
      if (loansContainer) loansContainer.innerHTML = loanEntries.length ? loanEntries.join("") : '<p class="reader-record"><span>Bạn chưa có phiếu mượn nào.</span></p>';
      if (reservationsContainer) reservationsContainer.innerHTML = reservationEntries.length ? reservationEntries.join("") : '<p class="reader-record"><span>Bạn chưa đặt chỗ sách nào.</span></p>';
      if (container) container.innerHTML = loanEntries.concat(reservationEntries).join("") || '<p class="card" style="padding:14px">Chưa có lịch sử mượn hoặc đặt chỗ.</p>';
    } catch (error) {
      [container, loansContainer, reservationsContainer].filter(Boolean).forEach(function (target) { target.innerHTML = '<p>' + global.MocThu.thanhPhan.escapeHtml(error.message) + '</p>'; });
    }
  }

  async function khoiTao() {
    if (heroInput) heroInput.addEventListener("input", function () {
      var query = heroInput.value.trim().toLocaleLowerCase("vi");
      document.querySelectorAll(".stitch-book-card").forEach(function (card) {
        card.hidden = card.textContent.toLocaleLowerCase("vi").indexOf(query) === -1;
      });
    });
    if (input) input.addEventListener("input", filterCatalog);
    if (categoryFilter) categoryFilter.addEventListener("change", filterCatalog);
    if (availableOnly) availableOnly.addEventListener("change", filterCatalog);
    await Promise.all([loadProfile(), loadHistory()]);
    if (grid || document.querySelector("[data-reader-reserve], .stitch-borrow-btn, [data-reader-detail]")) {
      try {
        var result = await global.MocThu.auth.request("/api/books");
        books = result.books || [];
      } catch (error) {
        if (grid) grid.innerHTML = '<p class="reader-record">' + global.MocThu.thanhPhan.escapeHtml(error.message) + '</p>';
        return;
      }
    }
    if (!grid) return;
    if (categoryFilter) {
      var selectedCategory = categoryFilter.value;
      var categories = Array.from(new Set(books.map(function (book) { return book.category; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, "vi"); });
      categoryFilter.innerHTML = '<option value="">Mọi thể loại</option>' + categories.map(function (category) {
        return '<option value="' + global.MocThu.thanhPhan.escapeHtml(category) + '">' + global.MocThu.thanhPhan.escapeHtml(category) + '</option>';
      }).join("");
      if (categories.includes(selectedCategory)) categoryFilter.value = selectedCategory;
    }
    var latestLimit = Number(grid.dataset.readerLatest || 0);
    var visibleBooks = latestLimit > 0 ? books.slice(0, latestLimit) : books;
    grid.innerHTML = visibleBooks.map(function (book, index) {
      var cover = index % 4 ? " cover-" + (index % 4 + 1) : "";
      var remaining = Math.max(0, Number(book.available_copies ?? (book.stock - book.borrowed)));
      return '<article class="reader-book-card" data-book-id="' + book.id + '"><div class="reader-book-cover' + cover + '">' + global.MocThu.thanhPhan.escapeHtml(book.name) + '</div>' +
        '<div class="reader-book-info"><h3>' + global.MocThu.thanhPhan.escapeHtml(book.name) + '</h3>' +
        '<p>' + global.MocThu.thanhPhan.escapeHtml(book.author) + ' · ' + global.MocThu.thanhPhan.escapeHtml(book.category) + '</p>' +
        '<div class="reader-book-meta"><span>' + (remaining ? 'Còn ' + remaining + ' bản' : 'Đang hết bản') + '</span>' +
        '<button type="button" data-reader-detail data-book-id="' + book.id + '">Chi tiết</button>' +
        '<button data-borrow data-book-id="' + book.id + '"' + (remaining ? '' : ' disabled') + '>Đặt trước</button></div></div></article>';
    }).join("") || '<p class="reader-record">Chưa có đầu sách trong danh mục.</p>';
    if (global.MocThu.biaSach) global.MocThu.biaSach.enhance(grid);
    filterCatalog();
  }

  document.addEventListener("click", async function (event) {
    var cancelReservation = event.target.closest("[data-cancel-reservation]");
    if (cancelReservation) {
      if (!global.confirm("Hủy yêu cầu đặt chỗ này?")) return;
      cancelReservation.disabled = true;
      try {
        await global.MocThu.auth.request("/api/reservations/" + cancelReservation.dataset.cancelReservation + "/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        await loadHistory();
        global.MocThu.thanhPhan.hienThongBao("Đã hủy yêu cầu đặt chỗ.");
      } catch (error) { cancelReservation.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
      return;
    }
    var renew = event.target.closest("[data-reader-renew]");
    if (renew) {
      renew.disabled = true;
      try {
        await global.MocThu.auth.request("/api/loans/" + renew.dataset.readerRenew + "/renew", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        await loadHistory();
        global.MocThu.thanhPhan.hienThongBao("Đã gia hạn thêm 7 ngày.");
      } catch (error) { renew.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
      return;
    }
    var reserve = event.target.closest(".stitch-borrow-btn, [data-reader-reserve], [data-borrow]");
    var detail = event.target.closest("[data-reader-detail]");
    if (detail) {
      var detailId = detail.dataset.bookId;
      if (detailId) {
        try {
          var result = await global.MocThu.auth.request("/api/books/" + detailId);
          var item = result.book;
          var copyStates = result.copies.reduce(function (counts, copy) { counts[copy.status] = (counts[copy.status] || 0) + 1; return counts; }, {});
          global.MocThu.thanhPhan.hienThongBao((item.summary || item.name) + " · Vị trí: " + (item.location || "Chưa cập nhật") +
            " · Bản sao: " + (copyStates.available || 0) + " sẵn sàng, " + (copyStates.loaned || 0) + " đang mượn, " + (copyStates.reserved || 0) + " giữ chỗ.");
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
        return;
      }
      var detailCard = detail.closest(".stitch-book-card");
      var detailName = detailCard && detailCard.querySelector(".stitch-book-name");
      var detailBook = books.find(function (book) { return detailName && detailName.textContent.toLocaleLowerCase("vi").includes(book.name.toLocaleLowerCase("vi")); });
      global.MocThu.thanhPhan.hienThongBao(detailBook ? (detailBook.summary || detailBook.name) : "Thông tin chi tiết chưa được cập nhật trong danh mục.");
      return;
    }
    if (!reserve) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var byId = books.find(function (item) { return String(item.id) === reserve.dataset.bookId; });
    if (byId) {
      reserve.disabled = true;
      try {
        await global.MocThu.auth.request("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookId: byId.id }) });
        global.MocThu.thanhPhan.hienThongBao("Đã gửi yêu cầu đặt " + byId.name + ".");
        await loadHistory();
      } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
      finally { reserve.disabled = false; }
      return;
    }
    var card = reserve.closest(".stitch-book-card");
    var title = card && card.querySelector(".stitch-book-name");
    var book = books.find(function (item) { return title && (title.textContent.toLocaleLowerCase("vi").includes(item.name.toLocaleLowerCase("vi")) || item.name.toLocaleLowerCase("vi").includes(title.textContent.toLocaleLowerCase("vi"))); });
    if (!book) {
      global.MocThu.thanhPhan.hienThongBao("Sách này chưa có trong danh mục đặt trước.");
      return;
    }
    reserve.disabled = true;
    try {
      await global.MocThu.auth.request("/api/reservations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookId: book.id })
      });
      global.MocThu.thanhPhan.hienThongBao("Đã gửi yêu cầu đặt " + book.name + ".");
    } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
    finally { reserve.disabled = false; }
  });

  var heroSearchButton = document.getElementById("userHeroSearchButton");
  if (heroSearchButton && heroInput) heroSearchButton.addEventListener("click", function () {
    heroInput.dispatchEvent(new Event("input", { bubbles: true }));
    var results = document.getElementById("popular");
    if (results) results.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelectorAll(".reader-quick-tag").forEach(function (tag) {
    tag.addEventListener("click", function () {
      if (!heroInput) return;
      heroInput.value = tag.textContent.trim() === "Sách mới phát hành" ? "" : tag.textContent.trim();
      heroInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  global.MocThu = global.MocThu || {};
  global.MocThu.docGia = { khoiTao: khoiTao };
}(window));
