(function (global) {
  "use strict";

  var thongBaoTimer;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function hienThongBao(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = "✓  " + message;
    toast.classList.add("show");
    global.clearTimeout(thongBaoTimer);
    thongBaoTimer = global.setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }

  function xuatCSV(filename, rows) {
    function escapeCell(value) {
      return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
    }

    var csv = "\uFEFF" + rows.map(function (row) {
      return row.map(escapeCell).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    hienThongBao("Đã xuất tệp " + filename);
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.thanhPhan = {
    escapeHtml: escapeHtml,
    hienThongBao: hienThongBao,
    xuatCSV: xuatCSV
  };
}(window));
