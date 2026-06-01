/* ランキング — ローカル(localStorage) + オンライン(Google Apps Script) 共通 */
window.Rank = (function () {
  "use strict";

  // ▼▼▼ Google Apps Script のウェブアプリ URL(/exec) を貼る。空ならローカルのみで動作 ▼▼▼
  var API = "https://script.google.com/macros/s/AKfycbw8PUjRx9os4nvKJ36JW_QaOsV6HbBG7ej0W5SqCEPa6Djx3RMp99GJA_fztDeaUwwS/exec";
  // ▲▲▲ 例: "https://script.google.com/macros/s/XXXXXXXX/exec" ▲▲▲

  // 各ゲーム設定。asc=true は「小さいほど上位」（クリアタイム等）
  var CFG = {
    runner: { asc: false, unit: 'm',  emoji: '💩', title: 'うんち回避！中年ダッシュ', metric: '距離' },
    neon:   { asc: false, unit: 'pt', emoji: '🎮', title: 'NEON BLASTER',            metric: 'スコア' },
    horror: { asc: true,  unit: '秒', emoji: '🕯️', title: '祓 — 八つのお札',          metric: 'クリア最速' },
    escape: { asc: true,  unit: '秒', emoji: '🔐', title: '密室からの脱出',           metric: 'クリア最速' },
    rush:   { asc: true,  unit: '秒', emoji: '🏁', title: 'RUSH タイムアタック',       metric: 'クリア最速', fmt: function(v){ return (v/100).toFixed(2); } }
  };
  // 表示整形（rushは1/100秒で保存→秒表示）
  function format(game, v){ var c = CFG[game]; if(!c) return '' + v; return (c.fmt ? c.fmt(v) : v) + c.unit; }

  // ---------- local (localStorage) ----------
  function read(game) { try { return JSON.parse(localStorage.getItem('rank_' + game) || '[]'); } catch (e) { return []; } }
  function write(game, arr) { try { localStorage.setItem('rank_' + game, JSON.stringify(arr)); } catch (e) {} }
  function sortArr(game, arr) { var asc = CFG[game].asc; arr.sort(function (a, b) { return asc ? a.s - b.s : b.s - a.s; }); return arr; }
  function getName() { return localStorage.getItem('player_name') || ''; }
  function setName(n) { localStorage.setItem('player_name', String(n || '').trim().slice(0, 16)); }
  function top(game, limit) { if (!CFG[game]) return []; return sortArr(game, read(game)).slice(0, limit || 10); }
  function clear(game) { if (game) localStorage.removeItem('rank_' + game); else for (var g in CFG) localStorage.removeItem('rank_' + g); }

  // ---------- online (Google Apps Script) ----------
  var jid = 0;
  function isOnline() { return /^https?:\/\//.test(API); }
  // 書き込み: no-cors POST（プリフライト回避のため text/plain。レスポンスは読めないが投入はされる）
  function postOnline(game, name, score) {
    if (!isOnline()) return;
    try {
      fetch(API, { method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ game: game, name: name, score: score }) });
    } catch (e) {}
  }
  // 読み取り: JSONP（CORS回避）。失敗/タイムアウトは null を返す
  function topOnline(game, limit) {
    return new Promise(function (resolve) {
      if (!isOnline()) { resolve(null); return; }
      var cb = '__rankcb_' + (jid++);
      var s = document.createElement('script');
      var done = false;
      var to = setTimeout(function () { fin(null); }, 8000);
      function fin(v) {
        if (done) return; done = true; clearTimeout(to);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
        resolve(v);
      }
      window[cb] = function (res) { fin(res && res.ok && res.rows ? res.rows : null); };
      s.onerror = function () { fin(null); };
      s.src = API + '?action=top&game=' + encodeURIComponent(game) + '&limit=' + (limit || 10) + '&callback=' + cb;
      document.head.appendChild(s);
    });
  }
  // オンライン優先・失敗時はローカル。常に Promise を返す
  function topAsync(game, limit) {
    if (!CFG[game]) return Promise.resolve([]);
    return topOnline(game, limit).then(function (rows) {
      if (rows === null) return top(game, limit);  // オフライン/失敗 → ローカル
      return rows.slice(0, limit || 10);           // オンライン（空配列もそのまま）
    }).catch(function () { return top(game, limit); });
  }

  // ---------- submit ----------
  function submitScore(game, score, opts) {
    if (!CFG[game]) return 0;
    var name = (getName() || 'ナナシ').slice(0, 16) || 'ナナシ';
    var entry = { n: name, s: Math.round(Number(score) || 0), t: Date.now() };
    var arr = read(game); arr.push(entry); sortArr(game, arr); write(game, arr.slice(0, 50));
    var rank = sortArr(game, read(game)).findIndex(function (e) { return e.t === entry.t; }) + 1;
    postOnline(game, entry.n, entry.s);
    if (!opts || opts.toast !== false) showToast(game, entry, rank);
    return rank;
  }

  // ---------- toast ----------
  var toastEl = null, toastT = null;
  function showToast(game, entry, rank) {
    if (!toastEl) {
      toastEl = document.createElement('div'); toastEl.id = 'rankToast';
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(40px);'
        + 'z-index:99999;background:rgba(8,10,18,.94);border:1px solid #d9b34a;border-radius:12px;'
        + 'padding:11px 20px;color:#f2ead2;font-family:sans-serif;font-size:14px;letter-spacing:1px;'
        + 'box-shadow:0 0 22px rgba(217,179,74,.45);opacity:0;transition:opacity .35s,transform .35s;'
        + 'pointer-events:none;text-align:center;white-space:nowrap;';
      document.body.appendChild(toastEl);
    }
    var c = CFG[game];
    var net = isOnline() ? '🌐' : '📱';
    var place = (rank <= 10) ? ('<span style="color:#7df9ff;font-weight:700">端末内 ' + rank + '位!</span>') : '端末内 圏外';
    toastEl.innerHTML = net + ' ランキング登録　<b style="color:#d9b34a">' + format(game, entry.s) + '</b>　' + place;
    setTimeout(function () { toastEl.style.opacity = '1'; toastEl.style.transform = 'translateX(-50%) translateY(0)'; }, 30);
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.style.opacity = '0'; toastEl.style.transform = 'translateX(-50%) translateY(40px)'; }, 2800);
  }

  return {
    CFG: CFG, top: top, topAsync: topAsync, submitScore: submitScore, format: format,
    getName: getName, setName: setName, read: read, clear: clear, isOnline: isOnline
  };
})();
