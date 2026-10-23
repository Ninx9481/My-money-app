/**
 * แอพรายรับรายจ่าย — ฝั่ง Google Apps Script (ใช้ Google Sheet เป็นฐานข้อมูล)
 *
 * วิธีใช้: เปิด Google Sheet ว่าง ๆ → ส่วนขยาย (Extensions) → Apps Script
 * วางโค้ดนี้ทั้งหมด → แก้ SECRET ด้านล่าง → Deploy เป็น Web app
 * (ดูขั้นตอนละเอียดใน README.md)
 */

// ===== ตั้งรหัสลับของคุณเอง (ต้องตรงกับที่กรอกในแอพ) =====
const SECRET = 'เปลี่ยนเป็นรหัสของคุณเอง';

const SHEET_TX = 'Transactions';
const SHEET_SET = 'Settings';
const HEADERS = ['id', 'date', 'type', 'amount', 'method', 'account', 'category', 'sub', 'note', 'travel', 'createdAt'];
// type: income | expense   method: account | cash   travel: 1 = ค่าเดินทาง

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function txSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_TX);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TX);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    // คอลัมน์ id, date, createdAt เป็นข้อความ กัน Sheet แปลงเป็นวันที่เอง
    [1, 2, 11].forEach(function (c) { sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
  }
  return sh;
}

function setSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_SET);
  if (!sh) {
    sh = ss.insertSheet(SHEET_SET);
    sh.appendRow(['key', 'value']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  return sh;
}

function text_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function readTx_() {
  const sh = txSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return rows.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return {
      id: text_(r[0]),
      date: text_(r[1]).slice(0, 10),
      type: text_(r[2]),
      amount: Number(r[3]) || 0,
      method: text_(r[4]),
      account: text_(r[5]),
      category: text_(r[6]),
      sub: text_(r[7]),
      note: text_(r[8]),
      travel: Number(r[9]) || 0,
      createdAt: text_(r[10])
    };
  });
}

function readSettings_() {
  const sh = setSheet_();
  const last = sh.getLastRow();
  const res = {};
  if (last < 2) return res;
  sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
    if (!r[0]) return;
    try { res[r[0]] = JSON.parse(r[1]); } catch (e) { /* ข้ามค่าที่เสีย */ }
  });
  return res;
}

function saveSettings_(settings) {
  const sh = setSheet_();
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 2).clearContent();
  const keys = Object.keys(settings || {});
  if (!keys.length) return;
  const rows = keys.map(function (k) { return [k, JSON.stringify(settings[k])]; });
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
}

function addTx_(t) {
  const sh = txSheet_();
  const last = sh.getLastRow();
  // กันบันทึกซ้ำ (เช่นแอพส่งซ้ำตอนเน็ตหลุด)
  if (last > 1) {
    const ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(t.id)) return;
  }
  sh.appendRow(txRow_(t));
}

function txRow_(t) {
  return [
    String(t.id), String(t.date), (t.type === 'income' || t.type === 'transfer') ? t.type : 'expense',
    Number(t.amount) || 0, t.method === 'cash' ? 'cash' : 'account',
    t.account || '', t.category || '', t.sub || '', t.note || '',
    t.travel ? 1 : 0, t.createdAt || new Date().toISOString()
  ];
}

// แก้ไขรายการเดิม (หาแถวจาก id แล้วเขียนทับทั้งแถว)
function updateTx_(t) {
  const sh = txSheet_();
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(t.id)) {
      const row = txRow_(t);
      sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      return;
    }
  }
}

function deleteTx_(id) {
  const sh = txSheet_();
  const last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); return; }
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.key !== SECRET) return out_({ ok: false, error: 'unauthorized' });
  return out_({ ok: true, tx: readTx_(), settings: readSettings_() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad_request' }); }
  if (body.key !== SECRET) return out_({ ok: false, error: 'unauthorized' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (body.op) {
      case 'add': addTx_(body.tx); break;
      case 'update': updateTx_(body.tx); break;
      case 'delete': deleteTx_(body.id); break;
      case 'saveSettings': saveSettings_(body.settings); break;
      case 'ping': break;
      default: return out_({ ok: false, error: 'unknown_op' });
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
