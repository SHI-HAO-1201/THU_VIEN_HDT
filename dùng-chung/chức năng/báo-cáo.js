(function (global) {
  "use strict";

  function xuatDanhMuc(sach) {
    global.MocThu.thanhPhan.xuatCSV("danh-muc-dau-sach.csv", [
      ["Tên sách", "Tác giả", "Mã tài liệu", "Thể loại", "Trong kho", "Đang mượn", "Tồn tối thiểu", "Vị trí", "Chất lượng"],
      ...sach.map(function (book) {
        return [book.name, book.author, book.code, book.category, book.stock, book.borrowed, book.minimum, book.location, book.quality];
      })
    ]);
  }

  function xuatTongQuan(sach) {
    global.MocThu.thanhPhan.xuatCSV("bao-cao-tong-quan.csv", [
      ["Chỉ tiêu", "Giá trị"],
      ["Tổng đầu sách", sach.length],
      ["Tổng bản sách", sach.reduce(function (sum, book) { return sum + book.stock; }, 0)],
      ["Lượt mượn đang mở", 248],
      ["Phiếu quá hạn", 12],
      ["Tiền phạt đã thu (VND)", 2450000]
    ]);
  }

  function xuatBaoCao(sach, nutDuocChon) {
    var filename = nutDuocChon.matches("#loansExport") ? "phieu-muon.csv" :
      (nutDuocChon.matches("#readersExport") ? "danh-sach-doc-gia.csv" :
        (nutDuocChon.matches("#receiptsExport") ? "phieu-nhap-xuat.csv" : "bao-cao-thu-vien.csv"));
    global.MocThu.thanhPhan.xuatCSV(filename, [
      ["Chỉ tiêu", "Giá trị"],
      ["Tổng đầu sách", sach.length],
      ["Tổng bản sách", sach.reduce(function (sum, book) { return sum + book.stock; }, 0)],
      ["Lượt mượn trong kỳ", 1486],
      ["Tiền phạt đã thu (VND)", 2450000],
      ["Ngày xuất", new Date().toLocaleDateString("vi-VN")]
    ]);
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.baoCao = {
    xuatDanhMuc: xuatDanhMuc,
    xuatTongQuan: xuatTongQuan,
    xuatBaoCao: xuatBaoCao
  };
}(window));
