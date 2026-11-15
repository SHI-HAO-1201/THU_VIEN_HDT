(function (global) {
  "use strict";

  var duLieu = global.MocThu.duLieu;
  var thanhPhan = global.MocThu.thanhPhan;
  var sach = global.MocThu.quanLySach;
  var danhSachSach = sach ? sach.danhSach : duLieu.sach;
  var baoCao = global.MocThu.baoCao;
  var mode = document.body.dataset.role || "librarian";
  var activePage = mode === "reader" ? "reader-home" : (mode === "librarian" ? "books" : "dashboard");
  var activeWarehouseSection = "warehouse-overview";
  var backdrop = document.getElementById("modalBackdrop");

  function veMenu() {
    var nav = document.getElementById("sidebarNav");
    var label = document.getElementById("sidebarLabel");
    if (!nav || !label) return;
    var entries = mode === "reader" ? duLieu.menuDocGia : (mode === "librarian" ? duLieu.menuThuThu : duLieu.menuQuanTri);
    label.textContent = mode === "reader" ? "Khám phá" : (mode === "librarian" ? "Nghiệp vụ thư viện" : "Quản trị hệ thống");
    nav.innerHTML = entries.map(function (item) {
      var isActive = mode === "librarian" && item.section ? item.section === activeWarehouseSection : item.id === activePage;
      var sectionAttribute = item.section ? ' data-section="' + item.section + '"' : "";
      return '<button class="nav-item' + (isActive ? ' active' : '') + '" data-go="' + item.id + '"' + sectionAttribute + '><span class="nav-icon">' + item.icon + '</span><span>' + item.label + '</span>' + (item.count ? '<span class="nav-count">' + item.count + '</span>' : '') + '</button>';
    }).join("");
  }

  function dongModalVaiTro() {
    var modal = document.getElementById("roleSwitchModal");
    if (modal) {
      modal.hidden = true;
      modal.style.display = "none";
    }
  }

  function moModalVaiTro() {
    var modal = damBaoModalVaiTro();
    modal.hidden = false;
    modal.style.display = "flex";
  }

  function damBaoModalVaiTro() {
    var modal = document.getElementById("roleSwitchModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "roleSwitchModal";
      modal.className = "role-modal-overlay";
      modal.hidden = true;
      modal.style.display = "none";
      modal.innerHTML = [
        '<div class="role-modal-card">',
        '  <div class="role-modal-header">',
        '    <h3>Chuyển đổi vai trò làm việc</h3>',
        '    <button class="role-modal-close" id="closeRoleModalBtn" type="button" aria-label="Đóng">✕</button>',
        '  </div>',
        '  <p class="role-modal-sub">Mỗi vai trò làm việc trong một không gian chuyên biệt độc lập. Chọn vai trò để chuyển sang phiên làm việc tương ứng:</p>',
        '  <div class="role-options">',
        '    <button class="role-option-card' + (mode === 'admin' ? ' current' : '') + '" type="button" data-switch-to="admin">',
        '      <span class="role-option-icon">👑</span>',
        '      <div class="role-option-info">',
        '        <strong>Quản trị viên (Admin)</strong>',
        '        <span>Bảng điều khiển KPI, báo cáo doanh thu & quản lý nhân sự</span>',
        '      </div>',
        '      <span class="role-option-badge">' + (mode === 'admin' ? 'Đang chọn' : 'Chuyển →') + '</span>',
        '    </button>',
        '    <button class="role-option-card' + (mode === 'librarian' ? ' current' : '') + '" type="button" data-switch-to="librarian">',
        '      <span class="role-option-icon">📚</span>',
        '      <div class="role-option-info">',
        '        <strong>Thủ thư (Librarian)</strong>',
        '        <span>Quản lý 1.250 đầu sách, kho & kiểm kê, mượn trả ấn phẩm</span>',
        '      </div>',
        '      <span class="role-option-badge">' + (mode === 'librarian' ? 'Đang chọn' : 'Chuyển →') + '</span>',
        '    </button>',
        '    <button class="role-option-card' + (mode === 'reader' ? ' current' : '') + '" type="button" data-switch-to="reader">',
        '      <span class="role-option-icon">🌿</span>',
        '      <div class="role-option-info">',
        '        <strong>Độc giả (Reader)</strong>',
        '        <span>Khám phá bộ sưu tập, tra cứu & tủ sách cá nhân</span>',
        '      </div>',
        '      <span class="role-option-badge">' + (mode === 'reader' ? 'Đang chọn' : 'Chuyển →') + '</span>',
        '    </button>',
        '  </div>',
        '  <div class="role-modal-foot">',
        '    <button class="danger-text-btn" id="logoutBtn" type="button">⎋ Đăng xuất khỏi hệ thống</button>',
        '  </div>',
        '</div>'
      ].join("");
      document.body.appendChild(modal);

      var closeBtn = modal.querySelector("#closeRoleModalBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          dongModalVaiTro();
        });
      }

      modal.addEventListener("click", function (e) {
        if (e.target === modal) {
          dongModalVaiTro();
        }
      });
    }
    return modal;
  }

  function moTrang(pageId) {
    var target = document.getElementById("page-" + pageId);
    if (!target) return;
    activePage = pageId;
    document.querySelectorAll(".page").forEach(function (page) {
      page.classList.toggle("active", page === target);
    });
    document.querySelectorAll("[data-go]").forEach(function (el) {
      if (!el.dataset.section) {
        el.classList.toggle("active", el.dataset.go === pageId);
      }
    });
    var sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("mobile-open");
    global.scrollTo({ top: 0, behavior: "smooth" });
  }

  function xuLyDieuHuong(event) {
    var brandLink = event.target.closest("a.brand[href^='#']");
    if (brandLink) {
      event.preventDefault();
      var targetId = brandLink.getAttribute("href").replace(/^#/, "");
      var targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll(".top-nav-links a").forEach(function (a, i) {
        a.classList.toggle("active", i === 0);
      });
      return;
    }

    var readerNav = event.target.closest(".top-nav-links a[href^='#']");
    if (readerNav && mode === "reader") {
      event.preventDefault();
      var navTargetId = readerNav.getAttribute("href").replace(/^#/, "");
      var navTargetEl = document.getElementById(navTargetId);
      if (navTargetEl) {
        document.querySelectorAll(".top-nav-links a").forEach(function (a) {
          a.classList.toggle("active", a === readerNav);
        });
        navTargetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    var go = event.target.closest("[data-go]");
    if (go) {
      var targetId = go.dataset.go;
      if (mode === "reader") {
        var readerSections = {
          "reader-home": "home", "reader-catalog": "reader-catalog", "reader-new": "new",
          "reader-categories": "popular", "reader-services": "guide", "reader-about": "shelf"
        };
        var readerSection = document.getElementById(readerSections[targetId] || "");
        if (readerSection) {
          event.preventDefault();
          readerSection.scrollIntoView({ behavior: "smooth", block: "start" });
          document.querySelectorAll("#sidebarNav [data-go]").forEach(function (item) { item.classList.toggle("active", item === go); });
          return;
        }
      }
      if (document.getElementById("page-" + targetId)) {
        if (go.dataset.section && mode === "librarian") {
          activeWarehouseSection = go.dataset.section;
          moTrang(targetId);
          var sec = document.getElementById(go.dataset.section);
          if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        moTrang(targetId);
        return;
      }
    }

    if (mode === "admin" && (event.target.closest("#roleSwitchBtn") || event.target.closest("#topUserChip"))) {
      moModalVaiTro();
      return;
    }

    if (event.target.closest("#closeRoleModalBtn") || event.target.id === "roleSwitchModal") {
      dongModalVaiTro();
      return;
    }

    var switchBtn = event.target.closest("[data-switch-to]");
    if (switchBtn) {
      var targetRole = switchBtn.dataset.switchTo;
      switchBtn.disabled = true;
      global.MocThu.auth.request("/api/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole })
      }).then(function (data) {
        if (data.home) global.location.href = data.home;
        else switchBtn.disabled = false;
      }).catch(function (error) {
        switchBtn.disabled = false;
        thanhPhan.hienThongBao(error.message || "Không thể chuyển vai trò.");
      });
      return;
    }

    if (event.target.closest("#logoutBtn")) {
      fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}"
      }).finally(function () {
        global.location.href = "/x%C3%A1c-th%E1%BB%B1c/giao%20di%E1%BB%87n/dang-nhap.html";
      });
      return;
    }

    var readerPage = event.target.closest("[data-reader-page]");
    if (readerPage) {
      moTrang(readerPage.dataset.readerPage);
      return;
    }

    if (event.target.closest("[data-open-book]")) {
      sach.moBieuMau(-1);
      return;
    }
    var edit = event.target.closest("[data-edit-book]");
    if (edit) {
      sach.moBieuMau(Number(edit.dataset.editBook));
      return;
    }
    var remove = event.target.closest("[data-delete-book]");
    if (remove) {
      sach.xoa(Number(remove.dataset.deleteBook));
      return;
    }
    if (event.target.closest("[data-close-modal]") || event.target === backdrop) {
      if (sach) sach.dongBieuMau();
      return;
    }
    if (event.target.closest("[data-borrow]")) {
      thanhPhan.hienThongBao("Chức năng đặt trước sẽ được kết nối với phiếu đặt trước của độc giả.");
      return;
    }
    var returnLoanButton = event.target.closest("[data-return-loan]");
    if (returnLoanButton) {
      var loanId = returnLoanButton.dataset.returnLoan;
      if (!loanId || !global.confirm("Xác nhận đã nhận trả sách trong phiếu này?")) return;
      var condition = global.prompt("Tình trạng tài liệu: nhập 1 nếu bình thường, 2 nếu hư hỏng, 3 nếu mất.", "1");
      if (condition === null) return;
      if (!["1", "2", "3"].includes(condition.trim())) {
        thanhPhan.hienThongBao("Vui lòng chọn 1, 2 hoặc 3.");
        return;
      }
      var compensation = 0;
      if (condition.trim() !== "1") {
        var amount = global.prompt("Nhập số tiền bồi thường (đồng). Nhập 0 nếu chưa xác định.", "0");
        if (amount === null) return;
        compensation = Number(amount);
        if (!Number.isSafeInteger(compensation) || compensation < 0) {
          thanhPhan.hienThongBao("Số tiền bồi thường không hợp lệ.");
          return;
        }
        if (compensation === 0) {
          thanhPhan.hienThongBao("Cần ghi nhận giá trị bồi thường trước khi kết thúc phiếu.");
          return;
        }
      }
      returnLoanButton.disabled = true;
      global.MocThu.auth.request("/api/loans/" + loanId + "/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ damaged: condition.trim() === "2", lost: condition.trim() === "3", compensationAmount: compensation })
      }).then(async function (result) {
        if (sach) {
          await sach.taiDanhSach();
          sach.veBang();
        }
        await taiPhieuMuon();
        thanhPhan.hienThongBao(result.totalDue ? "Đã nhận trả. Ghi nhận tiền phạt/bồi thường " + result.totalDue.toLocaleString("vi-VN") + "đ và khóa thẻ đến khi xử lý." : "Đã nhận trả sách và cập nhật tồn kho.");
      }).catch(function (error) {
        returnLoanButton.disabled = false;
        thanhPhan.hienThongBao(error.message);
      });
      return;
    }
    if (event.target.closest("#dashboardExport")) {
      baoCao.xuatTongQuan(danhSachSach);
      return;
    }
    if (event.target.closest("#booksExport") || event.target.closest("#warehouseExport")) {
      baoCao.xuatDanhMuc(danhSachSach);
      return;
    }
    var reportButton = event.target.closest("#reportsExport, #loansExport, #readersExport, #receiptsExport");
    if (reportButton) {
      baoCao.xuatBaoCao(danhSachSach, reportButton);
      return;
    }
    if (event.target.closest("#newLoanButton")) {
      moTrang("books");
      thanhPhan.hienThongBao("Chọn đầu sách rồi lập phiếu mượn từ phần xem chi tiết.");
      return;
    }
    if (event.target.closest("#newReceiptButton")) {
      thanhPhan.hienThongBao("Khung lập phiếu nhập sẵn sàng kết nối với nhà cung cấp.");
      return;
    }
    if (event.target.closest("#notificationButton")) {
      thanhPhan.hienThongBao("Bạn có 4 phiếu mượn sắp đến hạn trả.");
      return;
    }
    if (event.target.closest("#helpLink")) {
      event.preventDefault();
      thanhPhan.hienThongBao("Trung tâm hỗ trợ đang được cập nhật.");
    }
  }

  async function taiPhieuMuon() {
    var table = document.getElementById("loansTable");
    if (!table) return;
    try {
      var result = await global.MocThu.auth.request("/api/loans");
      var loans = result.loans || [];
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var activeCount = 0;
      var returnedTodayCount = 0;
      var dueSoonCount = 0;
      var overdueCount = 0;
      loans.forEach(function (loan) {
        if (loan.returnedAt) {
          var returnedAt = new Date(loan.returnedAt);
          if (returnedAt.toDateString() === today.toDateString()) returnedTodayCount += 1;
          return;
        }
        activeCount += 1;
        var dueDay = new Date(loan.dueAt);
        dueDay.setHours(0, 0, 0, 0);
        var daysLeft = Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);
        if (daysLeft < 0) overdueCount += 1;
        else if (daysLeft <= 3) dueSoonCount += 1;
      });
      var statValues = {
        loanActiveCount: activeCount,
        loanReturnedTodayCount: returnedTodayCount,
        loanDueSoonCount: dueSoonCount,
        loanOverdueCount: overdueCount
      };
      Object.keys(statValues).forEach(function (id) {
        var node = document.getElementById(id);
        if (node) node.textContent = String(statValues[id]);
      });
      if (!loans.length) {
        table.innerHTML = '<tr><td class="table-empty" colspan="7">Chưa có phiếu mượn nào.</td></tr>';
        return;
      }
      table.innerHTML = loans.map(function (loan) {
        var due = new Date(loan.dueAt);
        var borrowed = new Date(loan.borrowedAt);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var dueDay = new Date(due);
        dueDay.setHours(0, 0, 0, 0);
        var daysLeft = Math.ceil((dueDay.getTime() - today.getTime()) / 86400000);
        var returned = Boolean(loan.returnedAt);
        var status = returned ? '<span class="badge">Đã trả</span>' :
          (daysLeft < 0 ? '<span class="badge danger">Quá hạn ' + Math.abs(daysLeft) + ' ngày</span>' :
            (daysLeft <= 3 ? '<span class="badge warning">Sắp đến hạn</span>' : '<span class="badge">Đang mượn</span>'));
        var action = returned ? "Đã nhận trả" :
          '<button class="button small soft" data-return-loan="' + loan.id + '" type="button">Nhận trả</button>';
        var loanCode = "PM-" + borrowed.getFullYear() + "-" + String(loan.id).padStart(4, "0");
        return '<tr data-loan-id="' + loan.id + '">' +
          '<td><strong>' + thanhPhan.escapeHtml(loanCode) + '</strong></td>' +
          '<td>' + thanhPhan.escapeHtml(loan.readerCode) + '<br><small>' + thanhPhan.escapeHtml(loan.bookName) + '</small></td>' +
          '<td>' + borrowed.toLocaleDateString("vi-VN") + '</td>' +
          '<td>' + due.toLocaleDateString("vi-VN") + '</td>' +
          '<td>1 cuốn</td><td>' + status + '</td><td>' + action + '</td></tr>';
      }).join("");
    } catch (error) {
      table.innerHTML = '<tr><td class="table-empty" colspan="7">Không tải được danh sách phiếu mượn.</td></tr>';
      thanhPhan.hienThongBao(error.message);
    }
  }

  function khoiTao() {
    document.addEventListener("click", xuLyDieuHuong);
    var loanSearch = document.getElementById("loanSearch");
    if (loanSearch) loanSearch.addEventListener("input", function (event) {
      var query = event.target.value.toLocaleLowerCase("vi");
      document.querySelectorAll("#loansTable tr").forEach(function (row) {
        row.hidden = row.textContent.toLocaleLowerCase("vi").indexOf(query) === -1;
      });
    });
    var mobileMenu = document.getElementById("mobileMenuButton");
    if (mobileMenu) mobileMenu.addEventListener("click", function () {
      var sidebar = document.getElementById("sidebar");
      if (sidebar) sidebar.classList.toggle("mobile-open");
      else {
        var readerNav = document.querySelector(".top-nav-links");
        if (readerNav) readerNav.classList.toggle("mobile-open");
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        dongModalVaiTro();
        if (sach && sach.dongDrawer) sach.dongDrawer();
        if (sach && sach.dongBieuMau) sach.dongBieuMau();
      }
    });
    var requestedPage = global.location.hash.replace(/^#page-/, "");
    if (requestedPage && document.getElementById("page-" + requestedPage)) moTrang(requestedPage);
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.dieuHuong = {
    khoiTao: khoiTao,
    veMenu: veMenu,
    moTrang: moTrang,
    taiPhieuMuon: taiPhieuMuon
  };
}(window));
