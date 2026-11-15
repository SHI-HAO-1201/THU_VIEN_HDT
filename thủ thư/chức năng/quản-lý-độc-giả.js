(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var form = document.getElementById("readerCreateForm");
  var table = document.getElementById("readersTable");
  var search = document.getElementById("readerAccountSearch");
  var readers = [];
  function escape(value) { return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value); }
  function render() {
    if (!table) return;
    var query = search ? search.value.trim().toLocaleLowerCase("vi") : "";
    var matches = readers.filter(function (reader) {
      return [reader.full_name, reader.email, reader.card_code].join(" ").toLocaleLowerCase("vi").includes(query);
    });
    table.innerHTML = matches.length ? matches.map(function (reader) {
      var active = reader.card_status === "active" && reader.status === "active";
      var issue = reader.card_code ? "—" : '<button class="button small soft" type="button" data-issue-card="' + reader.id + '">Cấp thẻ</button>';
      var accountAction = '<button class="button small soft" type="button" data-reader-action="edit" data-reader-id="' + reader.id + '">Sửa</button> ' +
        '<button class="button small soft" type="button" data-reader-action="history" data-reader-id="' + reader.id + '">Lịch sử</button> ' +
        '<button class="button small soft" type="button" data-reader-action="toggle" data-reader-id="' + reader.id + '" data-reader-status="' + (reader.status === "active" ? "disabled" : "active") + '">' + (reader.status === "active" ? "Khóa TK" : "Mở TK") + '</button>';
      return '<tr><td><strong>' + escape(reader.card_code || "Chưa cấp") + '</strong></td>' +
        '<td>' + escape(reader.full_name) + '</td><td>' + escape(reader.email) + '</td>' +
        '<td>' + Number(reader.active_loans || 0) + '</td>' +
        '<td>' + (reader.expires_at ? new Date(reader.expires_at).toLocaleDateString("vi-VN") : "—") + '</td>' +
        '<td><span class="badge' + (active ? "" : " danger") + '">' + (reader.status !== "active" ? "Tài khoản khóa" : (reader.card_code ? (active ? "Thẻ hoạt động" : "Thẻ khóa" ) : "Chưa có thẻ")) + '</span></td><td>' + issue + ' ' + accountAction + '</td></tr>';
    }).join("") : '<tr><td class="table-empty" colspan="7">Chưa có độc giả phù hợp.</td></tr>';
  }
  async function load() {
    if (!table) return;
    try { readers = (await api("/api/readers")).readers || []; render(); }
    catch (error) { table.innerHTML = '<tr><td class="table-empty" colspan="7">' + escape(error.message) + '</td></tr>'; }
  }
  function init() {
    if (!table) return;
    var addButton = document.getElementById("newReaderButton");
    if (addButton) addButton.addEventListener("click", function () {
      form.hidden = !form.hidden;
      form.style.display = form.hidden ? "none" : "grid";
      if (!form.hidden) form.querySelector('[name="fullName"]').focus();
    });
    if (search) search.addEventListener("input", render);
    if (form) form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        var result = await api("/api/readers", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
        });
        form.reset(); form.hidden = true; form.style.display = "none";
        await load();
        global.MocThu.thanhPhan.hienThongBao("Đã tạo tài khoản và thẻ " + result.cardCode + ".");
      } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
      finally { button.disabled = false; }
    });
    table.addEventListener("click", async function (event) {
      var button = event.target.closest("[data-issue-card]");
      if (!button) {
        button = event.target.closest("[data-reader-action]");
        if (!button) return;
        var action = button.dataset.readerAction;
        var reader = readers.find(function (item) { return String(item.id) === button.dataset.readerId; });
        if (!reader) return;
        button.disabled = true;
        try {
          if (action === "edit") {
            var name = global.prompt("Họ và tên", reader.full_name); if (name === null) return;
            var email = global.prompt("Email", reader.email); if (email === null) return;
            await api("/api/readers/" + reader.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: name, email: email }) });
            await load();
          } else if (action === "toggle") {
            if (button.dataset.readerStatus === "disabled" && !global.confirm("Khóa tài khoản độc giả này?")) return;
            await api("/api/readers/" + reader.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.readerStatus }) });
            await load();
          } else {
            var history = await api("/api/readers/" + reader.id + "/history");
            var lines = history.loans.length ? history.loans.map(function (loan) { return loan.book_name + " · " + new Date(loan.borrowed_at).toLocaleDateString("vi-VN") + " · " + (loan.returned_at ? "Đã trả" : "Hạn " + new Date(loan.due_at).toLocaleDateString("vi-VN")); }).join("\n") : "Chưa có lịch sử mượn.";
            global.alert(lines);
          }
        } catch (error) { global.MocThu.thanhPhan.hienThongBao(error.message); }
        finally { button.disabled = false; }
        return;
      }
      button.disabled = true;
      try {
        var result = await api("/api/readers/" + button.dataset.issueCard + "/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        await load();
        global.MocThu.thanhPhan.hienThongBao("Đã cấp thẻ " + result.cardCode + ".");
      } catch (error) { button.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
    });
    load();
  }
  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyDocGia = { khoiTao: init };
}(window));
