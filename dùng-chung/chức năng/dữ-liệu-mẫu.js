(function (global) {
  "use strict";

  global.MocThu = global.MocThu || {};
  global.MocThu.duLieu = {
    menuQuanTri: [
      { id: "dashboard", label: "Dashboard tổng quan", icon: "▦" },
      { id: "accounts", label: "Tài khoản thủ thư", icon: "♙" },
      { id: "library-cards", label: "Thẻ thư viện", icon: "▣" },
      { id: "reports", label: "Thống kê & báo cáo", icon: "▥" }
    ],
    menuThuThu: [
      { id: "books", label: "Quản lý tài liệu", icon: "▤" },
      { id: "loans", label: "Mượn & trả", icon: "⇄", count: "18" },
      { id: "readers", label: "Độc giả & thẻ", icon: "♙" },
      { id: "library-cards", label: "Mở / khóa thẻ thư viện", icon: "▣" },
      { id: "warehouse", section: "warehouse-overview", label: "Nhập kho & tồn kho", icon: "▦" },
      { id: "warehouse", section: "warehouse-movements", label: "Phiếu nhập", icon: "⇄" },
      { id: "warehouse", section: "warehouse-shelves", label: "Kiểm kê tài liệu", icon: "✓" }
    ],
    menuDocGia: [
      { id: "reader-home", label: "Trang chủ", icon: "⌂" },
      { id: "reader-catalog", label: "Sản phẩm", icon: "▤" },
      { id: "reader-new", label: "Sách mới", icon: "✦" },
      { id: "reader-categories", label: "Thể loại", icon: "▦" },
      { id: "reader-services", label: "Dịch vụ", icon: "♡" },
      { id: "reader-about", label: "Giới thiệu", icon: "ⓘ" }
    ],
    sach: [
      { name: "Nhà giả kim", author: "Paulo Coelho", code: "VH-00124", category: "Văn học", stock: 25, borrowed: 18, minimum: 5, location: "A-02-14", quality: "Tốt" },
      { name: "Tuổi trẻ đáng giá bao nhiêu", author: "Rosie Nguyễn", code: "KN-00087", category: "Kỹ năng sống", stock: 20, borrowed: 14, minimum: 8, location: "B-01-08", quality: "Tốt" },
      { name: "Đắc nhân tâm", author: "Dale Carnegie", code: "KN-00031", category: "Kỹ năng sống", stock: 3, borrowed: 2, minimum: 5, location: "B-03-02", quality: "Cũ" },
      { name: "Rừng Na Uy", author: "Haruki Murakami", code: "VH-00209", category: "Văn học", stock: 18, borrowed: 11, minimum: 5, location: "A-04-22", quality: "Tốt" },
      { name: "Sống xanh mỗi ngày", author: "Katherine Martinko", code: "MT-00064", category: "Khác", stock: 4, borrowed: 0, minimum: 3, location: "C-02-01", quality: "Tốt" }
    ]
  };
}(window));
