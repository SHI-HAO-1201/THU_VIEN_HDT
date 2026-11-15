(function (global) {
  "use strict";
  var api = global.MocThu.auth.request;
  var table = document.getElementById("cardsTable");
  var requestsTable = document.getElementById("cardRequestsTable");
  var search = document.getElementById("cardSearch");
  var cards = [];
  function escape(value) { return global.MocThu.thanhPhan.escapeHtml(value == null ? "" : value); }
  function render() {
    var query = search ? search.value.trim().toLocaleLowerCase("vi") : "";
    var rows = cards.filter(function (card) { return [card.card_code, card.full_name, card.email].join(" ").toLocaleLowerCase("vi").includes(query); });
    table.innerHTML = rows.length ? rows.map(function (card) {
      var active = card.status === "active" && new Date(card.expires_at) > new Date();
      var action = '<div style="display:flex;gap:5px;flex-wrap:wrap"><button class="button small ' + (active ? "" : "soft") + '" data-card-id="' + card.id + '" data-card-action="toggle" data-next-status="' + (card.status === "active" ? "disabled" : "active") + '">' + (card.status === "active" ? "Khóa thẻ" : "Mở thẻ") + '</button>';
      if (document.body.dataset.role === "librarian") {
        action += '<button class="button small soft" data-card-id="' + card.id + '" data-card-action="renew">Gia hạn</button><button class="button small soft" data-card-id="' + card.id + '" data-card-action="replace">Cấp lại</button>';
      }
      action += '</div>';
      return '<tr><td><strong>' + escape(card.card_code) + '</strong></td><td>' + escape(card.full_name) + '</td><td>' + escape(card.email) + '</td>' +
        '<td>' + new Date(card.issued_at).toLocaleDateString("vi-VN") + '</td><td>' + new Date(card.expires_at).toLocaleDateString("vi-VN") + '</td>' +
        '<td><span class="badge' + (active ? "" : " danger") + '">' + (active ? "Đang mở" : (card.status === "active" ? "Hết hạn" : "Đã khóa")) + '</span></td><td>' + action + '</td></tr>';
    }).join("") : '<tr><td class="table-empty" colspan="7">Chưa có thẻ phù hợp.</td></tr>';
  }
  async function load() {
    try { cards = (await api("/api/cards")).cards || []; render(); }
    catch (error) { table.innerHTML = '<tr><td class="table-empty" colspan="7">' + escape(error.message) + '</td></tr>'; }
  }
  async function loadRequests() {
    if (!requestsTable) return;
    try {
      var result = await api("/api/card-requests");
      requestsTable.innerHTML = result.requests.length ? result.requests.map(function (item) {
        var pending = item.status === "pending";
        var label = item.status === "approved" ? "Đã duyệt" : (item.status === "rejected" ? "Đã từ chối" : "Đang chờ");
        return '<tr><td><strong>' + escape(item.full_name) + '</strong><br><small>' + escape(item.username) + '</small></td><td>' + escape(item.email) + '</td><td>' + escape(item.card_code || "Chưa cấp") + '</td><td>' + escape(item.note || "Cấp / gia hạn") + '</td><td>' + new Date(item.created_at).toLocaleDateString("vi-VN") + '</td><td><span class="badge' + (item.status === "rejected" ? " danger" : "") + '">' + label + '</span></td><td>' + (pending ? '<div class="card-request-actions"><button class="button small primary" data-request-id="' + item.id + '" data-request-action="approve" type="button">Duyệt</button><button class="button small soft" data-request-id="' + item.id + '" data-request-action="reject" type="button">Từ chối</button></div>' : '—') + '</td></tr>';
      }).join("") : '<tr><td class="table-empty" colspan="7">Chưa có yêu cầu cấp thẻ.</td></tr>';
    } catch (error) { requestsTable.innerHTML = '<tr><td class="table-empty" colspan="7">' + escape(error.message) + '</td></tr>'; }
  }
  function init() {
    if (!table && !requestsTable) return;
    var reload = document.getElementById("reloadCards");
    if (reload) reload.addEventListener("click", load);
    var reloadRequests = document.getElementById("reloadCardRequests");
    if (reloadRequests) reloadRequests.addEventListener("click", loadRequests);
    if (search) search.addEventListener("input", render);
    if (table) table.addEventListener("click", async function (event) {
      var button = event.target.closest("[data-card-id]");
      if (!button) return;
      button.disabled = true;
      try {
        var cardAction = button.dataset.cardAction;
        if (cardAction === "renew" || cardAction === "replace") {
          var result = await api("/api/cards/" + button.dataset.cardId + "/" + cardAction, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          global.MocThu.thanhPhan.hienThongBao(cardAction === "renew" ? "Đã gia hạn thẻ." : "Đã cấp lại thẻ " + result.cardCode + ".");
        } else {
          await api("/api/cards/" + button.dataset.cardId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.nextStatus }) });
        }
        await load();
      } catch (error) { button.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
    });
    if (requestsTable) requestsTable.addEventListener("click", async function (event) {
      var button = event.target.closest("[data-request-id]");
      if (!button) return;
      button.disabled = true;
      try {
        var result = await api("/api/card-requests/" + button.dataset.requestId + "/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: button.dataset.requestAction }) });
        await Promise.all([loadRequests(), load()]);
        global.MocThu.thanhPhan.hienThongBao(button.dataset.requestAction === "approve" ? "Đã duyệt yêu cầu và kích hoạt thẻ " + result.cardCode + "." : "Đã từ chối yêu cầu thẻ.");
      } catch (error) { button.disabled = false; global.MocThu.thanhPhan.hienThongBao(error.message); }
    });
    if (table) load();
    if (requestsTable) loadRequests();
  }
  global.MocThu = global.MocThu || {};
  global.MocThu.quanLyThe = { khoiTao: init };
}(window));
