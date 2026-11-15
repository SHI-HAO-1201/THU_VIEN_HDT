(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var tbody = document.getElementById("accountsTable");

  function escape(value) {
    return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value);
  }

  function render(users) {
    users = users.filter(function (user) { return user.role === "admin" || user.role === "librarian"; });
    if (!users.length) {
      tbody.innerHTML = '<tr><td class="table-empty" colspan="5">Chưa có tài khoản thủ thư.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(function (user) {
      var active = user.status === "active";
      var status = active ? '<span class="badge">Đang hoạt động</span>' : '<span class="badge danger">Đã khóa</span>';
      var action = '<div style="display:flex;gap:5px;flex-wrap:wrap">' +
        '<button class="button small ' + (active ? "" : "soft") + '" data-user-id="' + user.id + '" data-user-action="toggle" data-next-status="' + (active ? "disabled" : "active") + '">' + (active ? "Khóa" : "Mở khóa") + '</button>' +
        '<button class="button small soft" data-user-id="' + user.id + '" data-user-action="edit">Sửa</button>' +
        '<button class="button small soft" data-user-id="' + user.id + '" data-user-action="reset">Đặt mật khẩu</button>' +
        '<button class="button small soft" data-user-id="' + user.id + '" data-user-action="delete">Xóa</button></div>';
      var title = user.role === "admin" ? "Quản trị viên" : "Thủ thư";
      return '<tr><td><strong>' + escape(user.fullName) + '</strong></td><td>' + escape(user.username) + '</td><td>' + escape(user.email) + '<br><small>' + title + '</small></td><td class="account-status">' + status + '</td><td>' + action + '</td></tr>';
    }).join("");
  }

  async function load() {
    tbody.innerHTML = '<tr><td class="table-empty" colspan="5">Đang tải tài khoản…</td></tr>';
    try {
      var result = await api("/api/users");
      render(result.users);
    } catch (error) {
      tbody.innerHTML = '<tr><td class="table-empty" colspan="5">' + escape(error.message) + '</td></tr>';
    }
  }

  function init() {
    var form = document.getElementById("userCreateForm");
    if (!form || !tbody) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        var data = Object.fromEntries(new FormData(form).entries());
        await api("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        form.reset();
        await load();
        global.MocThu.thanhPhan.hienThongBao("Đã tạo tài khoản.");
      } catch (error) {
        global.MocThu.thanhPhan.hienThongBao(error.message);
      } finally { submit.disabled = false; }
    });
    document.getElementById("reloadUsers").addEventListener("click", load);
    tbody.addEventListener("click", async function (event) {
      var button = event.target.closest("[data-user-id]");
      if (!button) return;
      var action = button.dataset.userAction;
      var update;
      if (action === "toggle") {
        if (button.dataset.nextStatus === "disabled" && !global.confirm("Khóa tài khoản này?")) return;
        update = { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.nextStatus }) };
      } else if (action === "edit") {
        var row = button.closest("tr");
        var currentName = row.querySelector("td:nth-child(1)").textContent.trim();
        var currentUsername = row.querySelector("td:nth-child(2)").textContent.trim();
        var currentEmail = row.querySelector("td:nth-child(3)").childNodes[0].textContent.trim();
        var fullName = global.prompt("Họ và tên", currentName);
        if (fullName === null) return;
        var username = global.prompt("Tên đăng nhập", currentUsername);
        if (username === null) return;
        var email = global.prompt("Email", currentEmail);
        if (email === null) return;
        update = { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: fullName, username: username, email: email }) };
      } else if (action === "reset") {
        if (!global.confirm("Đặt lại mật khẩu và kết thúc các phiên đăng nhập của tài khoản này?")) return;
        button.disabled = true;
        try {
          var reset = await api("/api/users/" + button.dataset.userId + "/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          global.alert("Mật khẩu tạm thời: " + reset.temporaryPassword);
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
        finally { button.disabled = false; }
        return;
      } else if (action === "delete") {
        if (!global.confirm("Xóa tài khoản nhân sự này? Thao tác không thể hoàn tác.")) return;
        update = { method: "DELETE" };
      } else return;
      button.disabled = true;
      try {
        await api("/api/users/" + button.dataset.userId, update);
        await load();
      } catch (error) {
        global.MocThu.thanhPhan.hienThongBao(error.message);
        button.disabled = false;
      }
    });
    load();
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyTaiKhoan = { khoiTao: init };
}(window));
