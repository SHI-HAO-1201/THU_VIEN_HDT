(function () {
  "use strict";
  var forms = ["loginForm", "forgotForm", "resetForm"];
  var errorBox = document.getElementById("authError");
  var params = new URLSearchParams(location.search);
  var roleLabel = { admin: "Quản trị viên", librarian: "Thủ thư", reader: "Độc giả" };

  function showError(message, success) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.classList.toggle("success", Boolean(success));
  }
  function showForm(id) {
    forms.forEach(function (formId) {
      var form = document.getElementById(formId);
      if (form) form.hidden = formId !== id;
    });
    var demoLogin = document.getElementById("demoLogin");
    if (demoLogin) demoLogin.hidden = id !== "loginForm";
    errorBox.hidden = true;
  }
  async function send(url, payload) {
    var response = await fetch(url, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    var result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || "Không thể hoàn tất yêu cầu.");
    return result;
  }
  function submit(formId, handler) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var button = form.querySelector("[type=submit]");
      if (button) button.disabled = true;
      errorBox.hidden = true;
      try { await handler(Object.fromEntries(new FormData(form).entries())); }
      catch (error) { showError(error.message); }
      finally { if (button) button.disabled = false; }
    });
  }

  var role = params.get("role");
  if (roleLabel[role]) {
    document.getElementById("authIntro").textContent = "Đăng nhập bằng tài khoản đã cấp. Hệ thống sẽ tự mở đúng không gian " + roleLabel[role] + " theo quyền của tài khoản.";
  } else {
    document.getElementById("authIntro").textContent = "Đăng nhập bằng email hoặc tên tài khoản đã đăng ký.";
  }
  var loginLabel = document.querySelector('#loginForm input[name="username"]');
  if (loginLabel) {
    loginLabel.type = "text";
    loginLabel.autocomplete = "username";
    loginLabel.parentElement.firstChild.textContent = "Email hoặc tên đăng nhập";
  }

  showForm("loginForm");

  submit("loginForm", async function (data) {
    var result = await send("/api/login", data);
    location.replace(result.home || "/");
  });
  submit("forgotForm", async function (data) {
    var result = await send("/api/password-reset/request", data);
    showForm("resetForm");
    showError(result.message + " Nhập mã vừa nhận để đặt mật khẩu mới.", true);
  });
  submit("resetForm", async function (data) {
    if (data.password !== data.confirmPassword) throw new Error("Mật khẩu nhập lại chưa khớp.");
    await send("/api/password-reset/confirm", data);
    showForm("loginForm");
    showError("Đổi mật khẩu thành công. Bạn có thể đăng nhập.", true);
  });

  document.getElementById("forgotLink").addEventListener("click", function () { showForm("forgotForm"); });
  document.querySelectorAll("[data-demo-role]").forEach(function (button) {
    button.addEventListener("click", async function () {
      button.disabled = true;
      errorBox.hidden = true;
      try {
        var result = await send("/api/demo-login", { role: button.dataset.demoRole });
        location.replace(result.home || "/");
      } catch (error) { showError(error.message); }
      finally { button.disabled = false; }
    });
  });
  document.querySelectorAll("[data-show-login]").forEach(function (button) {
    button.addEventListener("click", function () { showForm("loginForm"); });
  });
  document.querySelectorAll("[data-toggle-password]").forEach(function (button) {
    button.addEventListener("click", function () {
      var input = document.getElementById(button.dataset.togglePassword);
      if (!input && button.closest("form")) input = button.closest("form").querySelector('input[type="password"]');
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Hiện" : "Ẩn";
    });
  });
}());
