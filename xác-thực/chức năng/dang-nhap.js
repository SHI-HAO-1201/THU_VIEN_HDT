(function () {
  "use strict";
  var loginForm = document.getElementById("loginForm");
  var setupForm = document.getElementById("setupForm");
  var readerSignupForm = document.getElementById("readerSignupForm");
  var errorBox = document.getElementById("authError");
  var switchButton = document.getElementById("authSwitchButton");
  var switchText = document.getElementById("authSwitchText");
  var authTitle = document.getElementById("authTitle");
  var authIntro = document.getElementById("authIntro");
  var showingSignup = false;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function enterApp(home) {
    globalThis.location.replace(home);
  }

  function sendForm(form, endpoint) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      errorBox.hidden = true;
      var values = Object.fromEntries(new FormData(form).entries());
      var button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        var response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(values)
        });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || "Không thể đăng nhập.");
        enterApp(result.home);
      } catch (error) {
        showError(error.message || "Không kết nối được máy chủ.");
      } finally {
        button.disabled = false;
      }
    });
  }

  sendForm(loginForm, "/api/login");
  sendForm(setupForm, "/api/setup");

  readerSignupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    errorBox.hidden = false;
    errorBox.textContent = "Khung đăng ký đã được tạo. Chức năng lưu tài khoản độc giả sẽ được nối với SQLite ở bước tiếp theo.";
  });
  switchButton.addEventListener("click", function () {
    showingSignup = !showingSignup;
    loginForm.hidden = showingSignup;
    readerSignupForm.hidden = !showingSignup;
    authTitle.textContent = showingSignup ? "Tạo tài khoản độc giả" : "Đăng nhập";
    authIntro.textContent = showingSignup
      ? "Tạo thông tin đăng nhập cá nhân để sử dụng hệ thống thư viện."
      : "Đăng nhập để vào đúng khu vực làm việc của bạn.";
    switchText.textContent = showingSignup ? "Đã có tài khoản?" : "Chưa có tài khoản độc giả?";
    switchButton.textContent = showingSignup ? "Đăng nhập" : "Tạo tài khoản";
    errorBox.hidden = true;
  });
  fetch("/api/setup/status", { credentials: "same-origin" })
    .then(function (response) { return response.json(); })
    .then(function (result) {
      var setup = result.needsSetup;
      loginForm.hidden = setup;
      setupForm.hidden = !setup;
      switchButton.hidden = setup;
      switchText.hidden = setup;
      authTitle.textContent = setup ? "Tạo quản trị viên" : "Đăng nhập";
      authIntro.textContent = setup
        ? "Thiết lập tài khoản quản trị để bắt đầu sử dụng hệ thống."
        : "Đăng nhập để vào đúng khu vực làm việc của bạn.";
    })
    .catch(function () { showError("Không kết nối được máy chủ. Hãy chạy server.py rồi tải lại trang."); });
}());
