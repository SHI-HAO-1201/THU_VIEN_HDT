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
      {
        id: 1,
        name: "Cây Cam Ngọt Của Tôi",
        author: "José Mauro de Vasconcelos",
        year: 2020,
        code: "VH-00124",
        isbn: "978-604-56-8291-3",
        category: "Văn học",
        tagClass: "tag-literature",
        stock: 15,
        borrowed: 4,
        minimum: 3,
        location: "Kệ A2 • Tủ 3 • Ngăn giữa (Tầng 2)",
        shelfLocation: "Kệ A2 • Tủ 3 • Tầng 2",
        price: 108000,
        summary: "Câu chuyện cảm động về cậu bé Zezé 5 tuổi thông minh, tinh nghịch nhưng luôn khao khát tình thương. Người bạn đặc biệt nhất của cậu là cây cam ngọt ở góc vườn – nơi cậu gửi gắm mọi niềm vui và nỗi buồn sâu kín.",
        preservation: 96,
        rfid: true,
        quality: "Tốt"
      },
      {
        id: 2,
        name: "Tư Duy Nhanh Và Chậm",
        author: "Daniel Kahneman",
        year: 2021,
        code: "KT-00089",
        isbn: "978-604-58-1206-1",
        category: "Kinh tế - Tâm lý",
        tagClass: "tag-psychology",
        stock: 8,
        borrowed: 7,
        minimum: 2,
        location: "Kệ B1 • Tủ 1 • Ngăn trên cùng (Tầng 1)",
        shelfLocation: "Kệ B1 • Tủ 1 • Tầng 1",
        price: 219000,
        summary: "Kiệt tác của nhà tâm lý học từng đoạt giải Nobel kinh tế Daniel Kahneman, giải phẫu hai hệ thống tư duy chi phối mọi quyết định và phán đoán của con người.",
        preservation: 92,
        rfid: true,
        quality: "Tốt"
      },
      {
        id: 3,
        name: "Sapiens: Lược Sử Loài Người",
        author: "Yuval Noah Harari",
        year: 2019,
        code: "LS-00204",
        isbn: "978-604-77-5120-4",
        category: "Lịch sử - Khoa học",
        tagClass: "tag-science",
        stock: 20,
        borrowed: 6,
        minimum: 4,
        location: "Kệ C3 • Tủ 2 • Ngăn thứ 3",
        shelfLocation: "Kệ C3 • Tủ 2 • Tầng 1",
        price: 260000,
        summary: "Cuốn sách khám phá toàn bộ lịch sử nhân loại từ thời đồ đá cổ xưa cho đến kỷ nguyên hiện đại, lý giải cách loài người Homo Sapiens thống trị hành tinh.",
        preservation: 95,
        rfid: true,
        quality: "Tốt"
      },
      {
        id: 4,
        name: "Phép Màu Thay Đổi Cuộc Sống",
        author: "Marie Kondo",
        year: 2022,
        code: "KN-00155",
        isbn: "978-604-99-9812-7",
        category: "Kỹ năng sống",
        tagClass: "tag-skills",
        stock: 12,
        borrowed: 9,
        minimum: 3,
        location: "Kệ D1 • Tủ 4 • Ngăn tầng 2",
        shelfLocation: "Kệ D1 • Tủ 4 • Tầng 2",
        price: 115000,
        summary: "Phương pháp dọn dẹp KonMari nổi tiếng toàn cầu, giúp sắp xếp lại không gian sống và tạo dựng một lối sống gọn gàng, thanh thản và hạnh phúc.",
        preservation: 88,
        rfid: true,
        quality: "Tốt"
      },
      {
        id: 5,
        name: "Hoàng Tử Bé (Bản minh họa màu)",
        author: "Antoine de Saint-Exupéry",
        year: 2023,
        code: "VH-00301",
        isbn: "978-604-2-19832-6",
        category: "Văn học thiếu nhi",
        tagClass: "tag-kids",
        stock: 25,
        borrowed: 6,
        minimum: 5,
        location: "Kệ A1 • Tủ 1 • Ngăn trưng bày chính",
        shelfLocation: "Kệ A1 • Tủ 1 • Tầng 1",
        price: 145000,
        summary: "Tác phẩm bất hủ về tình yêu, sự gắn kết và cách nhìn nhận thế giới bằng trái tim. 'Người ta chỉ thấy rõ bằng trái tim, cái cốt yếu thì vô hình đối với mắt'.",
        preservation: 98,
        rfid: true,
        quality: "Tốt"
      }
    ]
  };
}(window));
