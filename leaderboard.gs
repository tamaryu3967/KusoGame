/****************************************************************
 * KUSO ARCADE — オンラインランキング用 Google Apps Script
 * --------------------------------------------------------------
 * 使い方:
 *  1. Googleスプレッドシートを新規作成
 *  2. 拡張機能 → Apps Script を開く
 *  3. 既定コードを消して、このファイルの内容を貼り付けて保存
 *  4. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *       - 次のユーザーとして実行: 自分
 *       - アクセスできるユーザー: 全員
 *  5. 表示される「ウェブアプリ URL（…/exec）」を rank.js の API に貼る
 *
 * scores シートは初回アクセス時に自動作成されます。
 ****************************************************************/

var SHEET_NAME = 'scores';
// ゲームごとの並び方向（desc=大きいほど上位 / asc=小さいほど上位）
var GAMES = { runner: 'desc', neon: 'desc', horror: 'asc' };

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['timestamp', 'game', 'name', 'score']);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// スコア送信（フロントは no-cors POST、本文は JSON 文字列）
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var game = String(data.game || '');
    if (!GAMES.hasOwnProperty(game)) return json_({ ok: false, err: 'bad game' });
    var name = String(data.name || 'ナナシ').slice(0, 16) || 'ナナシ';
    var score = Number(data.score);
    if (!isFinite(score) || score < 0 || score > 1e9) return json_({ ok: false, err: 'bad score' });
    getSheet_().appendRow([new Date(), game, name, Math.round(score)]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, err: String(err) });
  }
}

// ランキング取得（フロントは JSONP で ?action=top&game=..&limit=..&callback=..）
function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  if (p.action === 'top') {
    out = topScores_(String(p.game || ''), Math.min(parseInt(p.limit || '10', 10) || 10, 50));
  } else {
    out = { ok: true, msg: 'KUSO ARCADE leaderboard' };
  }
  if (p.callback) {
    return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(out) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(out);
}

function topScores_(game, limit) {
  if (!GAMES.hasOwnProperty(game)) return { ok: false, rows: [] };
  var values = getSheet_().getDataRange().getValues(); // 1行目はヘッダ
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[1]) === game) {
      rows.push({ n: String(r[2]), s: Number(r[3]), t: new Date(r[0]).getTime() });
    }
  }
  var asc = GAMES[game] === 'asc';
  rows.sort(function (a, b) { return asc ? a.s - b.s : b.s - a.s; });
  return { ok: true, game: game, rows: rows.slice(0, limit) };
}
