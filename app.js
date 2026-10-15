(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* โหมดส่วนตัว/เต็ม */ } }
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const NF = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const money = n => NF.format(n);
const baht = n => (n < 0 ? '-' : '') + '฿' + money(Math.abs(n));

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const todayStr = () => ymd(new Date());

const F_FULL = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const F_DM = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });
const F_M = new Intl.DateTimeFormat('th-TH', { month: 'short' });
const F_W = new Intl.DateTimeFormat('th-TH', { weekday: 'short' });
const _FY = new Intl.DateTimeFormat('th-TH', { year: 'numeric' });
const F_Y = { format: d => _FY.format(d).replace(/^พ\.ศ\.\s*/, '') };

function dateLabel(s) {
  const t = todayStr();
  if (s === t) return 'วันนี้';
  if (s === ymd(addDays(new Date(), -1))) return 'เมื่อวาน';
  const d = parseYmd(s);
  return F_DM.format(d) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + F_Y.format(d) : '');
}

const EMO = /^(\p{Extended_Pictographic}[\p{Extended_Pictographic}\uFE0F\u200D\p{Emoji_Modifier}]*)\s*(.*)$/u;
function parseItem(s) {
  s = String(s).trim();
  const m = s.match(EMO);
  if (m && m[2]) return { icon: m[1], name: m[2].trim() };
  return { icon: '', name: s };
}

/* ================= state ================= */
const DEFAULTS = {
  accounts: ['บัญชีหลัก', 'บัญชีรอง'],
  expense: ['🍜 อาหาร', '☕ กาแฟ/เครื่องดื่ม', '🛒 ของใช้', '🏠 ที่พัก/ค่าเช่า', '💡 ค่าน้ำ/ไฟ/เน็ต', '🛍️ ช้อปปิ้ง', '💊 สุขภาพ', '🎬 บันเทิง', '🎁 ของขวัญ/ทำบุญ', '📚 การเรียน', '🧾 อื่นๆ'],
  income: ['💼 เงินเดือน', '🧑‍💻 งานเสริม', '🎁 ได้รับ/ของขวัญ', '📈 ดอกเบี้ย/ลงทุน', '💰 อื่นๆ'],
  travel: ['🚇 BTS/MRT', '🚕 แท็กซี่/แกร็บ', '🏍️ วินมอไซค์', '🚌 รถเมล์/สองแถว', '⛽ น้ำมัน', '🛣️ ทางด่วน/ที่จอดรถ', '🧳 อื่นๆ']
};

let cfg = Object.assign({ url: '', key: '', theme: 'auto', weekStart: 1 }, LS.get('cfg', {}));
let settings = Object.assign({}, DEFAULTS, LS.get('settings', {}));
let tx = LS.get('tx', []);
let queue = LS.get('queue', []);
let inflight = null;

const ui = {
  page: 'entry',
  mode: 'expense',            // expense | income | travel
  method: 'account',          // account | cash
  account: LS.get('lastAccount', ''),
  category: '',
  date: todayStr(),
  range: 'day',
  anchor: new Date()
};

const saveCfg = () => LS.set('cfg', cfg);
const saveSettingsLocal = () => LS.set('settings', settings);
const saveTx = () => LS.set('tx', tx);
const saveQueue = () => LS.set('queue', queue);

/* ================= theme ================= */
function applyTheme() {
  const r = document.documentElement;
  if (cfg.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', cfg.theme);
  const dark = cfg.theme === 'dark' || (cfg.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = $('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#0e0f13' : '#f2f3f7');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ================= toast ================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ================= icon maps ================= */
function maps() {
  const mk = list => { const m = {}; list.forEach(s => { const p = parseItem(s); m[p.name] = p.icon; }); return m; };
  return { expense: mk(settings.expense), income: mk(settings.income), travel: mk(settings.travel) };
}

function itemInfo(t, mp) {
  if (t.travel) return { icon: mp.travel[t.sub] || '🚌', title: t.sub || 'เดินทาง' };
  if (t.type === 'income') return { icon: mp.income[t.category] || '💰', title: t.category || 'รายรับ' };
  return { icon: mp.expense[t.category] || (t.category === 'เดินทาง' ? '🚌' : '🏷️'), title: t.category || 'ไม่ระบุ' };
}

function itemHTML(t, mp, showDate) {
  const info = itemInfo(t, mp);
  const way = t.method === 'cash' ? '💵 เงินสด' : '🏦 ' + (t.account || 'บัญชี');
  const sub = [showDate ? dateLabel(t.date) : '', way, t.note].filter(Boolean).map(esc).join(' · ');
  const sign = t.type === 'income' ? '+' : '−';
  return `<div class="item">
    <div class="ico">${esc(info.icon)}</div>
    <div class="mid"><div class="t">${esc(info.title)}</div><div class="s">${sub}</div></div>
    <div class="amt ${t.type}">${sign}${money(t.amount)}</div>
    <button class="del" type="button" data-del="${esc(t.id)}" aria-label="ลบ">✕</button>
  </div>`;
}

const sortTx = arr => arr.slice().sort((a, b) => (b.date.localeCompare(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));

/* ================= entry page ================= */
function listFor(mode) { return mode === 'income' ? settings.income : mode === 'travel' ? settings.travel : settings.expense; }

function renderEntry() {
  $('#entryCard').className = 'card entry mode-' + ui.mode;
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === ui.mode));
  $$('#methodSeg button').forEach(b => b.classList.toggle('on', b.dataset.method === ui.method));

  if (!settings.accounts.includes(ui.account)) ui.account = settings.accounts[0] || '';
  const accRow = $('#accountRow');
  if (ui.method === 'account' && settings.accounts.length > 1) {
    accRow.innerHTML = settings.accounts.map((a, i) => {
      const p = parseItem(a);
      return `<button type="button" class="chip${a === ui.account ? ' on' : ''}" data-acc="${i}">${esc((p.icon ? p.icon + ' ' : '') + p.name)}</button>`;
    }).join('');
  } else accRow.innerHTML = '';

  $('#catLabel').textContent = ui.mode === 'travel' ? 'ประเภทการเดินทาง' : 'หมวดหมู่';
  $('#catChips').innerHTML = listFor(ui.mode).map((c, i) => {
    const p = parseItem(c);
    return `<button type="button" class="chip${p.name === ui.category ? ' on' : ''}" data-cat="${i}">${esc((p.icon ? p.icon + ' ' : '') + p.name)}</button>`;
  }).join('');

  $('#saveBtn').textContent = ui.mode === 'income' ? 'บันทึกรายรับ' : ui.mode === 'travel' ? 'บันทึกค่าเดินทาง' : 'บันทึกรายจ่าย';
  $('#date').value = ui.date;
  $('#setupBanner').hidden = !!cfg.url;

  const mp = maps();
  const recent = tx.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);
  $('#todayTitle').textContent = 'บันทึกล่าสุด';
  const t = todayStr();
  const todayExp = tx.filter(x => x.date === t && x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  $('#todaySum').textContent = todayExp ? 'จ่ายวันนี้ ' + baht(todayExp) : '';
  $('#todayList').innerHTML = recent.length ? recent.map(x => itemHTML(x, mp, true)).join('') : '<div class="empty">ยังไม่มีรายการ</div>';
}

function parseAmount(s) {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function addEntry() {
  const amt = parseAmount($('#amount').value);
  if (!(amt > 0)) { toast('ใส่จำนวนเงินก่อนนะ'); $('#amount').focus(); return; }
  const travel = ui.mode === 'travel';
  const t = {
    id: uid(),
    date: ui.date || todayStr(),
    type: ui.mode === 'income' ? 'income' : 'expense',
    amount: amt,
    method: ui.method,
    account: ui.method === 'account' ? ui.account : '',
    category: travel ? 'เดินทาง' : (ui.category || 'ไม่ระบุ'),
    sub: travel ? ui.category : '',
    note: $('#note').value.trim(),
    travel: travel ? 1 : 0,
    createdAt: new Date().toISOString()
  };
  tx.push(t);
  queue.push({ op: 'add', tx: t });
  saveTx(); saveQueue();
  LS.set('lastAccount', ui.account);

  $('#amount').value = '';
  sizeAmount();
  $('#note').value = '';
  $('#amount').blur(); $('#note').blur();
  ui.category = '';
  ui.date = todayStr();
  renderEntry();
  toast('✓ บันทึกแล้ว ' + baht(amt));
  sync();
}

function removeTx(id) {
  const t = tx.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`ลบรายการนี้?\n${t.type === 'income' ? '+' : '−'}${money(t.amount)} · ${t.travel ? (t.sub || 'เดินทาง') : t.category}`)) return;
  tx = tx.filter(x => x.id !== id);
  const i = queue.findIndex(o => o.op === 'add' && o.tx.id === id);
  if (i >= 0 && queue[i] !== inflight) queue.splice(i, 1);
  else queue.push({ op: 'delete', id });
  saveTx(); saveQueue();
  render();
  toast('ลบแล้ว');
  sync();
}

/* ================= summary page ================= */
function periodOf(range, anchor) {
  if (range === 'day') return { s: ymd(anchor), e: ymd(anchor) };
  if (range === 'week') {
    const diff = (anchor.getDay() - cfg.weekStart + 7) % 7;
    const start = addDays(anchor, -diff);
    return { s: ymd(start), e: ymd(addDays(start, 6)), start };
  }
  const y = anchor.getFullYear();
  return { s: `${y}-01-01`, e: `${y}-12-31`, y };
}

function periodLabel(range, p) {
  if (range === 'day') {
    const d = parseYmd(p.s);
    return (p.s === todayStr() ? 'วันนี้ · ' : '') + F_FULL.format(d);
  }
  if (range === 'week') {
    const a = parseYmd(p.s), b = parseYmd(p.e);
    const left = a.getMonth() === b.getMonth() ? String(a.getDate()) : F_DM.format(a);
    return `${left} – ${F_DM.format(b)} ${F_Y.format(b)}`;
  }
  return 'ปี ' + F_Y.format(parseYmd(p.s));
}

function shiftAnchor(dir) {
  const a = ui.anchor;
  if (ui.range === 'day') ui.anchor = addDays(a, dir);
  else if (ui.range === 'week') ui.anchor = addDays(a, 7 * dir);
  else ui.anchor = new Date(a.getFullYear() + dir, a.getMonth(), Math.min(a.getDate(), 28));
}

const sum = (arr, f = x => x.amount) => arr.reduce((s, x) => s + f(x), 0);
function groupSum(arr, keyFn) {
  const m = new Map();
  arr.forEach(x => { const k = keyFn(x); m.set(k, (m.get(k) || 0) + x.amount); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function brkHTML(rows, total, cls) {
  if (!rows.length) return '<div class="empty">ไม่มีข้อมูล</div>';
  return rows.map(([name, v, icon]) => {
    const pct = total ? Math.round(v / total * 100) : 0;
    return `<div class="brk"><div class="h"><span>${esc(icon ? icon + ' ' : '')}${esc(name)}<em>${pct}%</em></span><span>${baht(v)}</span></div>
      <div class="track"><i class="${cls || ''}" style="width:${Math.max(pct, 2)}%"></i></div></div>`;
  }).join('');
}

function renderSummary() {
  const p = periodOf(ui.range, ui.anchor);
  const inRange = tx.filter(t => t.date >= p.s && t.date <= p.e);
  const inc = inRange.filter(t => t.type === 'income');
  const exp = inRange.filter(t => t.type === 'expense');
  const incSum = sum(inc), expSum = sum(exp), net = incSum - expSum;
  const mp = maps();

  $$('#rangeSeg button').forEach(b => b.classList.toggle('on', b.dataset.range === ui.range));
  $('#periodLabel').textContent = periodLabel(ui.range, p);
  $('#sumInc').textContent = baht(incSum);
  $('#sumExp').textContent = baht(expSum);
  $('#sumNet').textContent = baht(net);
  $('.tot.net').classList.toggle('neg', net < 0);

  /* chart (สัปดาห์ / ปี) */
  const chartCard = $('#chartCard');
  if (ui.range === 'day') chartCard.hidden = true;
  else {
    chartCard.hidden = false;
    let buckets;
    const t = todayStr();
    if (ui.range === 'week') {
      buckets = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(p.start, i), k = ymd(d);
        return { label: F_W.format(d), cur: k === t,
          e: sum(exp.filter(x => x.date === k)), i: sum(inc.filter(x => x.date === k)) };
      });
      $('#chartTitle').textContent = 'รายวันในสัปดาห์นี้';
    } else {
      buckets = Array.from({ length: 12 }, (_, m) => {
        const pre = `${p.y}-${pad(m + 1)}`;
        const now = new Date();
        return { label: F_M.format(new Date(p.y, m, 1)), cur: now.getFullYear() === p.y && now.getMonth() === m,
          e: sum(exp.filter(x => x.date.startsWith(pre))), i: sum(inc.filter(x => x.date.startsWith(pre))) };
      });
      $('#chartTitle').textContent = 'รายเดือนในปีนี้';
    }
    const max = Math.max(1, ...buckets.map(b => Math.max(b.e, b.i)));
    $('#chart').innerHTML = buckets.map(b => `<div class="col${b.cur ? ' cur' : ''}">
      <div class="bars"><div class="bar e" style="height:${b.e / max * 100}%"></div><div class="bar i" style="height:${b.i / max * 100}%"></div></div>
      <div class="lb">${esc(b.label)}</div></div>`).join('');
  }

  /* แยกตามวิธีจ่าย / หมวด / เดินทาง */
  const has = exp.length > 0;
  $('#splitCard').hidden = !has;
  $('#catCard').hidden = !has;
  const travel = exp.filter(t => t.travel);
  $('#travelCard').hidden = !travel.length;
  if (has) {
    const split = groupSum(exp, t => t.method === 'cash' ? 'เงินสด' : (t.account || 'บัญชี'))
      .map(([k, v]) => [k, v, k === 'เงินสด' ? '💵' : '🏦']);
    $('#splitList').innerHTML = brkHTML(split, expSum, 'acc');
    const cats = groupSum(exp, t => t.travel ? 'เดินทาง' : (t.category || 'ไม่ระบุ'))
      .map(([k, v]) => [k, v, k === 'เดินทาง' ? '🚌' : (mp.expense[k] || '🏷️')]);
    $('#catList').innerHTML = brkHTML(cats, expSum);
  }
  if (travel.length) {
    const ts = sum(travel);
    $('#travelTotal').textContent = baht(ts);
    const subs = groupSum(travel, t => t.sub || 'อื่นๆ').map(([k, v]) => [k, v, mp.travel[k] || '🚌']);
    $('#travelList').innerHTML = brkHTML(subs, ts, 'trv');
  }

  /* รายการ / ตารางรายเดือน */
  const dc = $('#detailList');
  if (ui.range === 'year') {
    $('#detailTitle').textContent = 'สรุปรายเดือน';
    dc.classList.remove('list');
    let html = '<div class="mrow head"><span>เดือน</span><span>รายรับ</span><span>รายจ่าย</span><span>คงเหลือ</span></div>';
    let any = false;
    for (let m = 0; m < 12; m++) {
      const pre = `${p.y}-${pad(m + 1)}`;
      const mi = sum(inc.filter(x => x.date.startsWith(pre))), me = sum(exp.filter(x => x.date.startsWith(pre)));
      if (!mi && !me) continue;
      any = true;
      html += `<div class="mrow"><span>${esc(F_M.format(new Date(p.y, m, 1)))}</span><span class="i">${money(mi)}</span><span class="e">${money(me)}</span><span>${money(mi - me)}</span></div>`;
    }
    dc.innerHTML = any ? html : '<div class="empty">ยังไม่มีรายการในปีนี้</div>';
  } else {
    $('#detailTitle').textContent = 'รายการ (' + inRange.length + ')';
    dc.classList.add('list');
    if (!inRange.length) dc.innerHTML = '<div class="empty">ยังไม่มีรายการ</div>';
    else {
      const sorted = sortTx(inRange);
      let html = '', cur = '';
      sorted.forEach(t => {
        if (ui.range === 'week' && t.date !== cur) {
          cur = t.date;
          const dayExp = sum(sorted.filter(x => x.date === cur && x.type === 'expense'));
          html += `<div class="dayhead"><span>${esc(F_FULL.format(parseYmd(cur)))}</span><span>${dayExp ? 'จ่าย ' + baht(dayExp) : ''}</span></div>`;
        }
        html += itemHTML(t, mp, false);
      });
      dc.innerHTML = html;
    }
  }
}

/* ================= sync ================= */
function setSync(state, text) {
  const b = $('#syncBtn');
  b.className = 'sync ' + (state === 'ok' ? 'ok' : state === 'busy' ? 'busy' : state === 'warn' ? 'warn' : state === 'err' ? 'err' : '');
  $('#syncText').textContent = text || ({ ok: 'ซิงค์แล้ว', busy: 'กำลังซิงค์', unset: 'ยังไม่เชื่อมต่อ' }[state] || '—');
}

async function fetchJson(url, opts, timeout = 20000) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, Object.assign({ redirect: 'follow', signal: ctl.signal }, opts));
    return await r.json();
  } finally { clearTimeout(tm); }
}

const apiGet = (url, key) =>
  fetchJson(url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key || '') + '&t=' + Date.now(), { cache: 'no-store' });

const apiPost = op =>
  fetchJson(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // text/plain = ไม่ติด CORS preflight
    body: JSON.stringify(Object.assign({ key: cfg.key }, op))
  });

async function flush() {
  while (queue.length) {
    const op = queue[0];
    inflight = op;
    let res;
    try { res = await apiPost(op); } catch (e) { inflight = null; return 'net'; }
    inflight = null;
    if (res && res.ok) {
      const k = queue.indexOf(op);
      if (k >= 0) queue.splice(k, 1);
      saveQueue();
    } else if (res && res.error === 'unauthorized') return 'auth';
    else return 'err';
  }
  return 'ok';
}

let syncing = false;
async function sync(manual) {
  if (!cfg.url) { setSync('unset'); return; }
  if (syncing) return;
  syncing = true;
  setSync('busy');
  try {
    let f = await flush();
    if (f === 'auth') { setSync('err', 'รหัสลับไม่ตรง'); if (manual) toast('รหัสลับไม่ตรงกับใน Code.gs'); return; }
    if (f === 'err') { setSync('err', 'เซิร์ฟเวอร์ผิดพลาด'); return; }
    if (f === 'net') { setSync('warn', queue.length ? queue.length + ' รอซิงค์' : 'ออฟไลน์'); return; }

    const res = await apiGet(cfg.url, cfg.key);
    if (!res.ok) { setSync('err', res.error === 'unauthorized' ? 'รหัสลับไม่ตรง' : 'ผิดพลาด'); return; }

    const server = (res.tx || []).map(t => Object.assign({}, t, { amount: Number(t.amount) || 0, travel: Number(t.travel) || 0 }));
    const pendDel = new Set(queue.filter(o => o.op === 'delete').map(o => o.id));
    const ids = new Set(server.map(t => t.id));
    tx = server.filter(t => !pendDel.has(t.id)).concat(queue.filter(o => o.op === 'add' && !ids.has(o.tx.id)).map(o => o.tx));
    saveTx();

    const hasPendingSettings = queue.some(o => o.op === 'saveSettings');
    const sv = res.settings || {};
    if (!hasPendingSettings) {
      if (Object.keys(sv).length) {
        settings = Object.assign({}, DEFAULTS, sv);
        saveSettingsLocal();
      } else {
        queue.push({ op: 'saveSettings', settings }); saveQueue();   // ชีตใหม่ → ส่งค่าเริ่มต้นขึ้นไป
        await flush();
      }
    }
    setSync(queue.length ? 'warn' : 'ok', queue.length ? queue.length + ' รอซิงค์' : undefined);
    if (manual) toast('ซิงค์เรียบร้อย');
  } catch (e) {
    setSync('warn', queue.length ? queue.length + ' รอซิงค์' : 'ออฟไลน์');
    if (manual) toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง');
  } finally {
    syncing = false;
    render();
  }
}

/* ================= settings sheet ================= */
function openSettings() {
  $('#cfgUrl').value = cfg.url;
  $('#cfgKey').value = cfg.key;
  $('#testMsg').textContent = ''; $('#testMsg').className = 'hint';
  $('#setAccounts').value = settings.accounts.join('\n');
  $('#setExpense').value = settings.expense.join('\n');
  $('#setIncome').value = settings.income.join('\n');
  $('#setTravel').value = settings.travel.join('\n');
  markSettingsSegs();
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSettings() { $('#sheet').hidden = true; document.body.style.overflow = ''; }
function markSettingsSegs() {
  $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === cfg.theme));
  $$('#weekSeg button').forEach(b => b.classList.toggle('on', Number(b.dataset.ws) === cfg.weekStart));
}
const lines = id => $(id).value.split('\n').map(s => s.trim()).filter(Boolean);

async function testConn() {
  const url = $('#cfgUrl').value.trim(), key = $('#cfgKey').value;
  const msg = $('#testMsg');
  if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) { msg.className = 'hint bad'; msg.textContent = 'URL ต้องขึ้นต้นด้วย https://script.google.com/ และลงท้าย /exec'; return; }
  msg.className = 'hint'; msg.textContent = 'กำลังทดสอบ…';
  try {
    const r = await apiGet(url, key);
    if (r.ok) { msg.className = 'hint ok'; msg.textContent = `เชื่อมต่อสำเร็จ ✓ พบ ${(r.tx || []).length} รายการ`; }
    else { msg.className = 'hint bad'; msg.textContent = r.error === 'unauthorized' ? 'รหัสลับไม่ตรงกับใน Code.gs' : 'เซิร์ฟเวอร์ตอบกลับผิดพลาด'; }
  } catch (e) {
    msg.className = 'hint bad';
    msg.textContent = 'เชื่อมต่อไม่ได้ — เช็ก URL และตอน Deploy ต้องตั้ง "Who has access" เป็น Anyone';
  }
}

function saveSettingsForm() {
  cfg.url = $('#cfgUrl').value.trim();
  cfg.key = $('#cfgKey').value;
  saveCfg();
  settings = {
    accounts: lines('#setAccounts'),
    expense: lines('#setExpense'),
    income: lines('#setIncome'),
    travel: lines('#setTravel')
  };
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
  ui.category = '';
  closeSettings();
  render();
  toast('บันทึกการตั้งค่าแล้ว');
  sync();
}

/* ================= navigation / render ================= */
function showPage(name) {
  ui.page = name;
  $('#page-entry').hidden = name !== 'entry';
  $('#page-summary').hidden = name !== 'summary';
  $('#pageTitle').textContent = name === 'entry' ? 'บันทึก' : 'สรุป';
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.page === name));
  window.scrollTo(0, 0);
  render();
}
function render() {
  if (ui.page === 'entry') renderEntry(); else renderSummary();
  if (!cfg.url) setSync('unset');
}

/* ================= events ================= */
$('#modeSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]'); if (!b) return;
  ui.mode = b.dataset.mode; ui.category = ''; renderEntry();
});
$('#methodSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-method]'); if (!b) return;
  ui.method = b.dataset.method; renderEntry();
});
$('#accountRow').addEventListener('click', e => {
  const b = e.target.closest('button[data-acc]'); if (!b) return;
  ui.account = settings.accounts[Number(b.dataset.acc)]; renderEntry();
});
$('#catChips').addEventListener('click', e => {
  const b = e.target.closest('button[data-cat]'); if (!b) return;
  const name = parseItem(listFor(ui.mode)[Number(b.dataset.cat)]).name;
  ui.category = ui.category === name ? '' : name;
  renderEntry();
});
const sizeAmount = () => { const a = $('#amount'); a.style.width = Math.max(1, a.value.length) + 'ch'; };
$('#amount').addEventListener('input', e => {
  const v = e.target.value.replace(/[^\d.,]/g, '');
  if (v !== e.target.value) e.target.value = v;
  sizeAmount();
});
$('#amount').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#note').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#date').addEventListener('change', e => { ui.date = e.target.value || todayStr(); });
$('#saveBtn').addEventListener('click', addEntry);

document.addEventListener('click', e => {
  const d = e.target.closest('[data-del]');
  if (d) removeTx(d.dataset.del);
});

$$('.tabs button').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
$('#rangeSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-range]'); if (!b) return;
  ui.range = b.dataset.range; renderSummary();
});
$('#prevBtn').addEventListener('click', () => { shiftAnchor(-1); renderSummary(); });
$('#nextBtn').addEventListener('click', () => { shiftAnchor(1); renderSummary(); });
$('#periodLabel').addEventListener('click', () => { ui.anchor = new Date(); renderSummary(); });

$('#settingsBtn').addEventListener('click', openSettings);
$('#setupBtn').addEventListener('click', openSettings);
$('#closeSheet').addEventListener('click', closeSettings);
$('#sheetBg').addEventListener('click', closeSettings);
$('#testBtn').addEventListener('click', testConn);
$('#saveCfg').addEventListener('click', saveSettingsForm);
$('#themeSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-theme]'); if (!b) return;
  cfg.theme = b.dataset.theme; saveCfg(); applyTheme(); markSettingsSegs();
});
$('#weekSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-ws]'); if (!b) return;
  cfg.weekStart = Number(b.dataset.ws); saveCfg(); markSettingsSegs();
});
$('#syncBtn').addEventListener('click', () => cfg.url ? sync(true) : openSettings());

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // วันเปลี่ยนตอนเปิดแอพค้างไว้ → รีเซ็ตวันที่
    if (ui.date < todayStr() && ui.page === 'entry' && !$('#amount').value) ui.date = todayStr();
    sync();
  }
});
window.addEventListener('online', () => sync());

/* ================= boot ================= */
applyTheme();
render();
sizeAmount();
setSync(cfg.url ? (queue.length ? 'warn' : 'ok') : 'unset', cfg.url && queue.length ? queue.length + ' รอซิงค์' : undefined);
sync();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
