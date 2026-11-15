(function () {
  "use strict";
  fetch("/api/setup/status", { credentials: "same-origin" })
    .then(function (response) { return response.json(); })
    .then(function (state) {
      if (state.needsSetup) location.replace("dang-nhap.html?role=admin&setup=1");
    })
    .catch(function () {
      var note = document.createElement("p");
      note.className = "auth-error";
      note.setAttribute("role", "alert");
      note.textContent = "Không kết nối được máy chủ. Hãy chạy server.py rồi tải lại trang.";
      document.querySelector(".role-select-card").prepend(note);
    });
}());
