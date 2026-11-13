(function (global) {
  "use strict";

  function locBangKho() {
    var query = (document.getElementById("warehouseSearch").value || "").trim().toLocaleLowerCase("vi");
    var boLoc = document.querySelector("#warehouseFilters .filter-button.active").dataset.whFilter;

    document.querySelectorAll("#warehouseTable tr").forEach(function (row) {
      var text = row.textContent.toLocaleLowerCase("vi");
      var khopTimKiem = text.indexOf(query) !== -1;
      var khopBoLoc = boLoc === "all" ||
        (boLoc === "low" && (text.indexOf("cần nhập") !== -1 || text.indexOf("cân nhắc nhập") !== -1)) ||
        (boLoc === "stale" && (text.indexOf("tồn trên 12 tháng") !== -1 || text.indexOf("thanh lý") !== -1)) ||
        (boLoc === "audit" && text.indexOf("cũ") !== -1);
      row.hidden = !khopTimKiem || !khopBoLoc;
    });
  }

  function khoiTao() {
    document.getElementById("warehouseSearch").addEventListener("input", locBangKho);
    document.getElementById("warehouseFilters").addEventListener("click", function (event) {
      var button = event.target.closest("[data-wh-filter]");
      if (!button) return;
      document.querySelectorAll("#warehouseFilters .filter-button").forEach(function (filter) {
        filter.classList.toggle("active", filter === button);
      });
      locBangKho();
    });
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyKho = { khoiTao: khoiTao, locBang: locBangKho };
}(window));
