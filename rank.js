/* ランキング（端末内ローカル / localStorage）— 全ゲーム共通 */
window.Rank = (function () {
  "use strict";
  // 各ゲームの設定。asc=true は「小さいほど上位」（クリアタイム等）
  var CFG = {
    runner: { asc: false, unit: 'm',  emoji: '💩', title: 'うんち回避！中年ダッシュ', metric: '距離' },
    neon:   { asc: false, unit: 'pt', emoji: '🎮', title: 'NEON BLASTER',            metric: 'スコア' },
    horror: { asc: true,  unit: '秒', emoji: '🕯️', title: '祓 — 八つのお札',          metric: 'クリア最速' }
  };

  function read(game) { try { return JSON.parse(localStorage.getItem('rank_' + game) || '[]'); } catch (e) { return []; } }
  function write(game, arr) { try { localStorage.setItem('rank_' + game, JSON.stringify(arr)); } catch (e) {} }
  function sortArr(game, arr) { var asc = CFG[game].asc; arr.sort(function (a, b) { return asc ? a.s - b.s : b.s - a.s; }); return arr; }

  function getName() { return localStorage.getItem('player_name') || ''; }
  function setName(n) { localStorage.setItem('player_name', String(n || '').trim().slice(0, 16)); }

  function top(game, limit) { if (!CFG[game]) return []; return sortArr(game, read(game)).slice(0, limit || 10); }

  // スコア登録。stored name を使用（無ければ「ナナシ」）。順位を返す。
  function submitScore(game, score, opts) {
    if (!CFG[game]) return 0;
    var name = (getName() || 'ナナシ').slice(0, 16);
    var entry = { n: name, s: Math.round(Number(score) || 0), t: Date.now() };
    var arr = read(game); arr.push(entry); sortArr(game, arr); write(game, arr.slice(0, 50));
    var rank = sortArr(game, read(game)).findIndex(function (e) { return e.t === entry.t; }) + 1;
    if (!opts || opts.toast !== false) showToast(game, entry, rank);
    return rank;
  }

  function clear(game) { if (game) localStorage.removeItem('rank_' + game); else for (var g in CFG) localStorage.removeItem('rank_' + g); }

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
    var place = (rank <= 10) ? '<span style="color:#7df9ff;font-weight:700">' + rank + '位!</span>' : '圏外';
    toastEl.innerHTML = '🏆 ランキング登録　<b style="color:#d9b34a">' + entry.s + c.unit + '</b>　' + place;
    setTimeout(function () { toastEl.style.opacity = '1'; toastEl.style.transform = 'translateX(-50%) translateY(0)'; }, 30);
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.style.opacity = '0'; toastEl.style.transform = 'translateX(-50%) translateY(40px)'; }, 2800);
  }

  return { CFG: CFG, top: top, submitScore: submitScore, getName: getName, setName: setName, read: read, clear: clear };
})();
