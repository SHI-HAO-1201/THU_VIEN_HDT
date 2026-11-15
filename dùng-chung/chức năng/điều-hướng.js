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
    var entries = mode === "reader" ? duLieu.menuDocGia : (mode === "librarian" ? duLieu.menuThuThu : duLieu.menuQuanTri);
    label.textContent = mode === "reader" ? "Khám phá" : (mode === "librarian" ? "Nghiệp vụ thư viện" : "Quản trị hệ thống");
    nav.innerHTML = entries.map(function (item) {
      var isActive = mode === "librarian" && item.section ? item.section === activeWarehouseSection : item.id === activePage;
      var sectionAttribute = item.section ? ' data-section="' + item.section + '"' : "";
      return '<button class="nav-item' + (isActive ? ' active' : '') + '" data-go="' + item.id + '"' + sectionAttribute + '><span class="nav-icon">' + item.icon + '</span><span>' + item.label + '</span>' + (item.count ? '<span class="nav-count">' + item.count + '</span>' : '') + '</button>';
    }).join("");
  }

  function moTrang(pageId) {
    var target = document.getElementById("page-" + pageId);
    if (!target) return;
    activePage = pageId;
    document.querySelectorAll(".page").forEach(function (page) {
      page.classList.toggle("active", page === target);
    });
    veMenu();
    document.getElementById("sidebar").classList.remove("mobile-open");
    global.scrollTo({ top: 0, behavior: "smooth" });
  }

  function xuLyDieuHuong(event) {
    var go = event.target.closest("[data-go]");
    if (go) {
      if (!document.getElementById("page-" + go.dataset.go) && mode === "admin" && ["books", "loans", "readers", "warehouse"].indexOf(go.dataset.go) !== -1) {
        global.location.href = "../../thủ thư/giao diện/trang-chủ.html#page-" + go.dataset.go;
        return;
      }
      if (go.dataset.section && mode === "librarian") {
        activeWarehouseSection = go.dataset.section;
        document.getElementById(go.dataset.section).scrollIntoView({ behavior: "smooth", block: "start" });
        veMenu();
        return;
      }
      moTrang(go.dataset.go);
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
    if (event.target.closest("[data-return-loan]")) {
      if (global.confirm("Xác nhận đã nhận lại các bản sách trong phiếu này?")) {
        event.target.closest("tr").querySelector("td:nth-child(6)").innerHTML = '<span class="badge">Đã trả</span>';
        event.target.closest("tr").querySelector("td:last-child").textContent = "Hoàn tất";
        thanhPhan.hienThongBao("Đã cập nhật trạng thái phiếu mượn.");
      }
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
      thanhPhan.hienThongBao("Khung tạo phiếu mượn sẵn sàng kết nối với dữ liệu độc giả.");
      return;
    }
    if (event.target.closest("#newReaderButton")) {
      thanhPhan.hienThongBao("Khung thêm độc giả sẵn sàng kết nối với hồ sơ thẻ.");
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
      document.getElementById("sidebar").classList.toggle("mobile-open");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sach) sach.dongBieuMau();
    });
    var requestedPage = global.location.hash.replace(/^#page-/, "");
    if (requestedPage && document.getElementById("page-" + requestedPage)) moTrang(requestedPage);
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.dieuHuong = {
    khoiTao: khoiTao,
    veMenu: veMenu,
    moTrang: moTrang
  };
}(window));
