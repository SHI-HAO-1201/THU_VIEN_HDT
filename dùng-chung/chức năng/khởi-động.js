(function (global) {
  "use strict";
  var app = global.MocThu;
  (async function () {
    await app.auth.khoiTao();
    if (app.quanLySach && document.getElementById("bookForm")) app.quanLySach.khoiTao();
    if (app.quanLyKho && document.getElementById("warehouseSearch")) app.quanLyKho.khoiTao();
    if (app.docGia) { try { await app.docGia.khoiTao(); } catch (error) { app.thanhPhan.hienThongBao(error.message); } }
    if (app.quanLyTaiKhoan) app.quanLyTaiKhoan.khoiTao();
    app.dieuHuong.khoiTao();
    app.dieuHuong.veMenu();
    if (app.quanLySach && document.getElementById("booksTable")) {
      try { await app.quanLySach.taiDanhSach(); app.quanLySach.veBang(); }
      catch (error) { app.thanhPhan.hienThongBao(error.message); }
    }
  }());
}(window));
