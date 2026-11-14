(function (global) {
  "use strict";

  var roleNames = { admin: "Quản trị viên", librarian: "Thủ thư", reader: "Độc giả" };

  async function request(url, options) {
    var response = await fetch(url, Object.assign({ credentials: "same-origin" }, options || {}));
    var result = await response.json().catch(function () { return {}; });
    if (response.status === 401) {
      global.location.replace("/x%C3%A1c-th%E1%BB%B1c/giao%20di%E1%BB%87n/dang-nhap.html");
      throw new Error("Phiên đăng nhập đã hết hạn.");
    }
    if (!response.ok) throw new Error(result.error || "Yêu cầu không thành công.");
    return result;
  }

  async function khoiTao() {
    try {
      var result = await request("/api/session");
      var user = result.user;
      var pageRole = document.body.dataset.role;
      var roleSwitchButton = document.getElementById("roleSwitchBtn");
      if (roleSwitchButton) {
        roleSwitchButton.hidden = user.role !== "admin";
        roleSwitchButton.style.display = user.role === "admin" ? "" : "none";
      }
      var homes = {
        admin: "/qu%E1%BA%A3n%20l%C3%AD/giao%20di%E1%BB%87n/trang-ch%E1%BB%A7.html",
        librarian: "/th%E1%BB%A7%20th%C6%B0/giao%20di%E1%BB%87n/trang-ch%E1%BB%A7.html",
        reader: "/%C4%90%E1%BB%99c%20gi%E1%BA%A3/giao%20di%E1%BB%87n/trang-ch%E1%BB%A7.html"
      };
      if (pageRole && user.role !== pageRole && homes[user.role]) {
        global.location.replace(homes[user.role]);
        return;
      }
      var name = document.getElementById("topUserName");
      var role = document.getElementById("topUserRole");
      var avatar = document.getElementById("topAvatar");
      var sidebarName = document.getElementById("sidebarUserName");
      var sidebarRole = document.getElementById("sidebarUserRole");
      if (name) name.textContent = user.fullName;
      if (role) role.textContent = roleNames[user.role] || user.role;
      if (avatar) avatar.textContent = user.fullName.trim().split(/\s+/).slice(-2).map(function (part) { return part.charAt(0); }).join("").toLocaleUpperCase("vi");
      if (sidebarName) sidebarName.textContent = user.fullName;
      if (sidebarRole) sidebarRole.textContent = roleNames[user.role] || user.role;
      var logout = document.getElementById("logoutButton");
      if (logout) logout.addEventListener("click", async function () {
        logout.disabled = true;
        try { await request("/api/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); }
        finally { global.location.replace("/x%C3%A1c-th%E1%BB%B1c/giao%20di%E1%BB%87n/dang-nhap.html"); }
      });
    } catch (error) {
      if (error.message !== "Phiên đăng nhập đã hết hạn.") global.location.replace("/x%C3%A1c-th%E1%BB%B1c/giao%20di%E1%BB%87n/dang-nhap.html");
    }
  }

  global.MocThu = global.MocThu || {};
  global.MocThu.auth = { request: request, khoiTao: khoiTao };
}(window));
