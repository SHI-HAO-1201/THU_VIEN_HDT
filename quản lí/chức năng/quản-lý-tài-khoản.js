(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var tbody = document.getElementById("accountsTable");

  function escape(value) {
    return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value);
  }

  function render(users) {
    users = users.filter(function (user) { return user.role === "librarian"; });
    if (!users.length) {
      tbody.innerHTML = '<tr><td class="table-empty" colspan="5">Chưa có tài khoản thủ thư.</td></tr>';
      return;
    }
    tbody.innerHTML = users.map(function (user) {
      var active = user.status === "active";
      var status = active ? '<span class="badge">Đang hoạt động</span>' : '<span class="badge danger">Đã khóa</span>';
      var action = '<button class="button small ' + (active ? "" : "soft") + '" data-user-id="' + user.id + '" data-next-status="' + (active ? "disabled" : "active") + '"' + (user.role === "admin" && active ? ' title="Không thể khóa quản trị viên đang đăng nhập bằng thao tác nhanh"' : "") + '>' + (active ? "Khóa" : "Mở khóa") + '</button>';
      return '<tr><td><strong>' + escape(user.fullName) + '</strong></td><td>' + escape(user.username) + '</td><td>Thủ thư</td><td class="account-status">' + status + '</td><td>' + action + '</td></tr>';
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
      if (button.dataset.nextStatus === "disabled" && !global.confirm("Khóa tài khoản này?")) return;
      button.disabled = true;
      try {
        await api("/api/users/" + button.dataset.userId, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: button.dataset.nextStatus })
        });
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
