(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode / full */ } }
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

const F_FULL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const F_DM = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const F_M = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const F_W = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const F_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const F_Y = new Intl.DateTimeFormat('en-GB', { year: 'numeric' });

function dateLabel(s) {
  if (s === todayStr()) return 'Today';
  if (s === ymd(addDays(new Date(), -1))) return 'Yesterday';
  const d = parseYmd(s);
  return F_DM.format(d) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + F_Y.format(d) : '');
}

const EMO = /^(\p{Extended_Pictographic}[\p{Extended_Pictographic}️‍\p{Emoji_Modifier}]*)\s*(.*)$/u;
function parseItem(s) {
  s = String(s).trim();
  const m = s.match(EMO);
  if (m && m[2]) return { icon: m[1], name: m[2].trim() };
  return { icon: '', name: s };
}

/* ================= constants / defaults ================= */
const TRAVEL = 'Travel';
const TO_CASH = '@cash';        // marks cash as the destination of a transfer (stored in the 'sub' column)
const CASH_KEY = '__cash__';
const NONE = 'Uncategorized';

const DEFAULTS = {
  accounts: ['Main account', 'Second account'],
  expense: ['🍜 Food', '☕ Coffee & drinks', '🛒 Groceries', '🏠 Rent & housing', '💡 Bills & internet', '🛍️ Shopping', '💊 Health', '🎬 Entertainment', '🎁 Gifts & donations', '📚 Education', '🧾 Other'],
  income: ['💼 Salary', '🧑‍💻 Side income', '🎁 Gifts received', '📈 Interest & investments', '💰 Other'],
  travel: ['🚇 BTS/MRT', '🚕 Taxi/Grab', '🏍️ Motorcycle taxi', '🚌 Bus/Songthaew', '⛽ Fuel', '🛣️ Tolls & parking', '🧳 Other']
};

// The first (Thai) version of the app saved these default lists to the sheet.
// If a list is still exactly the old default, it is swapped for the English one.
const LEGACY_DEFAULTS = {
  accounts: ['บัญชีหลัก', 'บัญชีรอง'],
  expense: ['🍜 อาหาร', '☕ กาแฟ/เครื่องดื่ม', '🛒 ของใช้', '🏠 ที่พัก/ค่าเช่า', '💡 ค่าน้ำ/ไฟ/เน็ต', '🛍️ ช้อปปิ้ง', '💊 สุขภาพ', '🎬 บันเทิง', '🎁 ของขวัญ/ทำบุญ', '📚 การเรียน', '🧾 อื่นๆ'],
  income: ['💼 เงินเดือน', '🧑‍💻 งานเสริม', '🎁 ได้รับ/ของขวัญ', '📈 ดอกเบี้ย/ลงทุน', '💰 อื่นๆ'],
  travel: ['🚇 BTS/MRT', '🚕 แท็กซี่/แกร็บ', '🏍️ วินมอไซค์', '🚌 รถเมล์/สองแถว', '⛽ น้ำมัน', '🛣️ ทางด่วน/ที่จอดรถ', '🧳 อื่นๆ']
};
// Old entries saved with Thai default names are displayed in English.
const LEGACY_NAMES = {
  'อาหาร': 'Food', 'กาแฟ/เครื่องดื่ม': 'Coffee & drinks', 'ของใช้': 'Groceries', 'ที่พัก/ค่าเช่า': 'Rent & housing',
  'ค่าน้ำ/ไฟ/เน็ต': 'Bills & internet', 'ช้อปปิ้ง': 'Shopping', 'สุขภาพ': 'Health', 'บันเทิง': 'Entertainment',
  'ของขวัญ/ทำบุญ': 'Gifts & donations', 'การเรียน': 'Education', 'อื่นๆ': 'Other',
  'เงินเดือน': 'Salary', 'งานเสริม': 'Side income', 'ได้รับ/ของขวัญ': 'Gifts received', 'ดอกเบี้ย/ลงทุน': 'Interest & investments',
  'แท็กซี่/แกร็บ': 'Taxi/Grab', 'วินมอไซค์': 'Motorcycle taxi', 'รถเมล์/สองแถว': 'Bus/Songthaew', 'น้ำมัน': 'Fuel', 'ทางด่วน/ที่จอดรถ': 'Tolls & parking',
  'เดินทาง': TRAVEL, 'ไม่ระบุ': NONE, 'เงินสด': 'Cash', 'บัญชีหลัก': 'Main account', 'บัญชีรอง': 'Second account', 'บัญชี': 'Account'
};
const tn = name => LEGACY_NAMES[name] || name;

function migrate(s) {
  let changed = false;
  const out = Object.assign({}, s);
  Object.keys(LEGACY_DEFAULTS).forEach(k => {
    if (JSON.stringify(out[k]) === JSON.stringify(LEGACY_DEFAULTS[k])) { out[k] = DEFAULTS[k].slice(); changed = true; }
  });
  return { s: out, changed };
}

/* ================= state ================= */
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
  anchor: new Date(),
  entriesOpen: LS.get('entriesOpen', false),
  from: '', to: '',
  recentN: 50, q: '', budEdit: false,
  balEdit: false
};

const saveCfg = () => LS.set('cfg', cfg);
const saveSettingsLocal = () => LS.set('settings', settings);
const saveTx = () => LS.set('tx', tx);
const saveQueue = () => LS.set('queue', queue);

{ // one-time migration of old Thai defaults
  const m = migrate(settings);
  if (m.changed) {
    settings = m.s; saveSettingsLocal();
    queue = queue.filter(o => o.op !== 'saveSettings');
    queue.push({ op: 'saveSettings', settings }); saveQueue();
  }
}

/* ================= theme ================= */
const COLORS = { light: '#f4f2ed', dark: '#0e0f13' };
function applyTheme() {
  const r = document.documentElement;
  if (cfg.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', cfg.theme);
  $$('meta[name="theme-color"]').forEach(m => {
    if (m.dataset.media === undefined) m.dataset.media = m.getAttribute('media') || '';
    if (cfg.theme === 'auto') {
      m.setAttribute('media', m.dataset.media);
      m.setAttribute('content', m.dataset.media.includes('dark') ? COLORS.dark : COLORS.light);
    } else {
      m.setAttribute('media', 'all');
      m.setAttribute('content', COLORS[cfg.theme]);
    }
  });
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
  const mk = (list, fallback) => { const m = {}; list.forEach(s => { const p = parseItem(s); m[p.name] = p.icon || fallback || ''; }); return m; };
  return { expense: mk(settings.expense), income: mk(settings.income), travel: mk(settings.travel), accounts: mk(settings.accounts, '🏦') };
}
const ic = (map, raw) => map[raw] || map[tn(raw)] || '';
const acctIcon = (mp, name) => ic(mp.accounts, name) || '🏦';

function itemInfo(t, mp) {
  if (t.type === 'transfer') return { icon: '🔁', title: 'Transfer' };
  if (t.travel) return { icon: ic(mp.travel, t.sub) || '🚌', title: tn(t.sub) || TRAVEL };
  if (t.type === 'income') return { icon: ic(mp.income, t.category) || '💰', title: tn(t.category) || 'Income' };
  return { icon: ic(mp.expense, t.category) || (tn(t.category) === TRAVEL ? '🚌' : '🏷️'), title: tn(t.category) || NONE };
}

function itemHTML(t, mp, showDate) {
  const info = itemInfo(t, mp);
  const end = (cash, name) => cash ? '💵 Cash' : acctIcon(mp, name) + ' ' + (tn(name) || 'Account');
  const way = t.type === 'transfer' ? end(t.method === 'cash', t.account) + ' → ' + end(t.sub === TO_CASH, t.sub) : end(t.method === 'cash', t.account);
  const sub = [showDate ? dateLabel(t.date) : '', way, t.note].filter(Boolean).map(esc).join(' · ');
  const sign = t.type === 'transfer' ? '' : t.type === 'income' ? '+' : '−';
  return `<div class="item" data-edit="${esc(t.id)}">
    <div class="ico">${esc(info.icon)}</div>
    <div class="mid"><div class="t">${esc(info.title)}</div><div class="s">${sub}</div></div>
    <div class="amt ${t.type}">${sign}${money(t.amount)}</div>
    <button class="del" type="button" data-del="${esc(t.id)}" aria-label="Delete">✕</button>
  </div>`;
}

const sortTx = arr => arr.slice().sort((a, b) => (b.date.localeCompare(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));

/* ================= entry page ================= */
function listFor(mode) { return mode === 'income' ? settings.income : mode === 'travel' ? settings.travel : settings.expense; }
const accountNames = () => settings.accounts.map(a => parseItem(a).name);

function sizeAmount() {
  const a = $('#amount');
  $('#amountMirror').textContent = a.value || '0.00';   // hidden mirror = exact text width → number stays centred
}

function renderEntry() {
  $('#entryCard').className = 'card entry mode-' + ui.mode;
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === ui.mode));
  $$('#methodSeg button').forEach(b => b.classList.toggle('on', b.dataset.method === ui.method));
  const isTr = ui.mode === 'transfer';
  $('#methodGroup').hidden = isTr; $('#catGroup').hidden = isTr; $('#transferGroup').hidden = !isTr;

  const names = accountNames();
  if (!names.includes(ui.account)) ui.account = names[0] || '';
  const accRow = $('#accountRow');
  if (ui.method === 'account' && settings.accounts.length > 1) {
    accRow.innerHTML = settings.accounts.map((a, i) => {
      const p = parseItem(a);
      return `<button type="button" class="chip${p.name === ui.account ? ' on' : ''}" data-acc="${i}">${esc(p.name)}</button>`;
    }).join('');
  } else accRow.innerHTML = '';

  if (isTr) {
    const ends = [{ v: CASH_KEY, n: 'Cash' }].concat(accountNames().map(n => ({ v: n, n })));
    if (!ends.some(e => e.v === ui.from)) ui.from = ends.length > 1 ? ends[1].v : CASH_KEY;
    if (!ends.some(e => e.v === ui.to) || ui.to === ui.from) ui.to = (ends.find(e => e.v !== ui.from) || {}).v || '';
    const row = (cur, attr) => ends.map(e => `<button type="button" class="chip${e.v === cur ? ' on' : ''}" data-${attr}="${esc(e.v)}">${esc(e.n)}</button>`).join('');
    $('#fromRow').innerHTML = row(ui.from, 'from');
    $('#toRow').innerHTML = row(ui.to, 'to');
  }
  $('#catLabel').textContent = ui.mode === 'travel' ? 'Travel type' : 'Category';
  $('#catChips').innerHTML = listFor(ui.mode).map((c, i) => {
    const p = parseItem(c);
    return `<button type="button" class="chip${p.name === ui.category ? ' on' : ''}" data-cat="${i}">${esc(p.name)}</button>`;
  }).join('');

  $('#saveBtn').textContent = ui.mode === 'transfer' ? 'Save transfer' : ui.mode === 'income' ? 'Save income' : ui.mode === 'travel' ? 'Save travel' : 'Save expense';
  $('#date').value = ui.date;
  $('#setupBanner').hidden = !!cfg.url;

}

function parseAmount(s) {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function addEntry() {
  const amt = parseAmount($('#amount').value);
  if (!(amt > 0)) { toast('Enter an amount first'); $('#amount').focus(); return; }
  const travel = ui.mode === 'travel';
  if (ui.mode === 'transfer') {
    if (!ui.from || !ui.to || ui.from === ui.to) { toast('Pick two different accounts'); return; }
    const fc = ui.from === CASH_KEY;
    var tr = { method: fc ? 'cash' : 'account', account: fc ? '' : ui.from, category: 'Transfer', sub: ui.to === CASH_KEY ? TO_CASH : ui.to };
  }
  const t = {
    id: uid(),
    date: ui.date || todayStr(),
    type: ui.mode === 'income' ? 'income' : ui.mode === 'transfer' ? 'transfer' : 'expense',
    amount: amt,
    method: ui.method,
    account: ui.method === 'account' ? ui.account : '',
    category: travel ? TRAVEL : (ui.category || NONE),
    sub: travel ? ui.category : '',
    note: $('#note').value.trim(),
    travel: travel ? 1 : 0,
    createdAt: new Date().toISOString()
  };
  if (tr) Object.assign(t, tr);
  tx.push(t);
  queue.push({ op: 'add', tx: t });
  saveTx(); saveQueue();
  if (ui.mode !== 'transfer') LS.set('lastAccount', ui.account);

  $('#amount').value = '';
  sizeAmount();
  $('#note').value = '';
  $('#amount').blur(); $('#note').blur();
  ui.category = '';
  ui.date = todayStr();
  renderEntry();
  toast('✓ Saved ' + baht(amt));
  sync();
}

function queueUpdate(t) {
  const k = queue.findIndex(o => (o.op === 'add' || o.op === 'update') && o.tx.id === t.id && o !== inflight);
  if (k >= 0) queue[k] = Object.assign({}, queue[k], { tx: t });   // fold into the not-yet-sent op
  else queue.push({ op: 'update', tx: t });
}

function removeTx(id) {
  const t = tx.find(x => x.id === id);
  if (!t) return;
  const label = t.type === 'transfer' ? 'Transfer' : t.travel ? (tn(t.sub) || TRAVEL) : tn(t.category);
  if (!confirm(`Delete this entry?\n${t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−'}${money(t.amount)} · ${label}`)) return;
  tx = tx.filter(x => x.id !== id);
  queue = queue.filter(o => !(o.op === 'update' && o.tx.id === id && o !== inflight));
  const i = queue.findIndex(o => o.op === 'add' && o.tx.id === id);
  if (i >= 0 && queue[i] !== inflight) queue.splice(i, 1);
  else queue.push({ op: 'delete', id });
  saveTx(); saveQueue();
  render();
  toast('Deleted');
  sync();
}

/* ================= recent page ================= */
function searchText(t, mp) {
  const info = itemInfo(t, mp);
  return [info.title, t.type, t.note, tn(t.category), tn(t.sub === TO_CASH ? 'Cash' : t.sub), t.method === 'cash' ? 'cash' : tn(t.account), String(t.amount), money(t.amount)]
    .filter(Boolean).join(' ').toLowerCase();
}
function renderRecent() {
  const mp = maps();
  const q = ui.q.trim().toLowerCase();
  let sorted = sortTx(tx);
  if (q) sorted = sorted.filter(t => searchText(t, mp).includes(q));
  const shown = sorted.slice(0, ui.recentN);
  if (!shown.length) {
    $('#recentList').innerHTML = `<div class="card"><div class="empty">${q ? 'No matching entries' : 'No entries yet'}</div></div>`;
  } else {
    const groups = [];
    shown.forEach(t => {
      let g = groups[groups.length - 1];
      if (!g || g.date !== t.date) { g = { date: t.date, items: [] }; groups.push(g); }
      g.items.push(t);
    });
    $('#recentList').innerHTML = groups.map(g => {
      const dayExp = sum(sorted.filter(x => x.date === g.date && x.type === 'expense'));
      return `<div class="list-head"><h2>${esc(dateLabel(g.date))}</h2><span>${!q && dayExp ? 'Spent ' + baht(dayExp) : ''}</span></div>
        <div class="card list">${g.items.map(t => itemHTML(t, mp, false)).join('')}</div>`;
    }).join('');
  }
  $('#recentMore').hidden = sorted.length <= shown.length;
}

/* ================= balance page ================= */
const openingMap = () => (settings.opening && typeof settings.opening === 'object') ? settings.opening : {};
function balances() {
  const op = openingMap();
  const rows = new Map();
  const row = (key, name, editable) => { if (!rows.has(key)) rows.set(key, { key, name, editable, open: Number(op[key]) || 0, inc: 0, exp: 0 }); return rows.get(key); };
  accountNames().forEach(n => row(n, n, true));
  row(CASH_KEY, 'Cash', true);
  tx.forEach(t => {
    const side = (cash, name) => cash ? row(CASH_KEY, 'Cash', true) : row(tn(name) || 'Account', tn(name) || 'Account', false);
    if (t.type === 'transfer') {
      side(t.method === 'cash', t.account).exp += t.amount;        // money leaves the source
      side(t.sub === TO_CASH, t.sub).inc += t.amount;               // and arrives at the destination
      return;
    }
    const r = side(t.method === 'cash', t.account);
    if (t.type === 'income') r.inc += t.amount; else r.exp += t.amount;
  });
  Object.keys(op).forEach(k => { if (Number(op[k]) && k !== CASH_KEY) row(k, k, false); });
  const list = [...rows.values()].map(r => Object.assign(r, { bal: Math.round((r.open + r.inc - r.exp) * 100) / 100 }));
  // keep the configured order; cash last; unknown/removed accounts after the accounts
  const rank = r => r.key === CASH_KEY ? 2 : r.editable ? 0 : 1;
  list.sort((a, b) => rank(a) - rank(b));
  return list;
}

function renderBalance() {
  const list = balances();
  const total = Math.round(list.reduce((s, r) => s + r.bal, 0) * 100) / 100;
  $('#balTotal').textContent = baht(total);
  $('#balTotal').classList.toggle('neg', total < 0);
  $('#balSub').textContent = list.length > 1 ? 'Across ' + list.length + ' places' : '';
  $('#balEdit').textContent = ui.balEdit ? 'Done' : 'Set starting balance';
  $('#balHint').textContent = ui.balEdit
    ? 'Enter how much each account held before your first entry here. Balance = starting balance + income − expenses.'
    : 'Balance = starting balance + all income − all expenses. Tap “Set starting balance” if you already had money in an account.';
  $('#balList').innerHTML = list.map(r => {
    const sub = r.editable || r.open ? '' : 'Not in your account list';
    if (ui.balEdit && r.editable) {
      return `<div class="brow"><div class="mid"><div class="t">${esc(r.name)}</div><div class="s">Starting balance</div></div>
        <input class="open-in" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-open="${esc(r.key)}" value="${r.open || ''}" aria-label="Starting balance for ${esc(r.name)}"></div>`;
    }
    const detail = `In ${baht(r.inc)} · Out ${baht(r.exp)}` + (r.open ? ` · Start ${baht(r.open)}` : '');
    return `<div class="brow"><div class="mid"><div class="t">${esc(r.name)}</div><div class="s">${esc(sub || detail)}</div></div>
      <div class="bv${r.bal < 0 ? ' neg' : ''}">${baht(r.bal)}</div></div>`;
  }).join('');
}

function commitOpening() {
  const op = Object.assign({}, openingMap());
  $$('#balList input[data-open]').forEach(i => {
    const v = parseAmount(i.value);
    if (v) op[i.dataset.open] = v; else delete op[i.dataset.open];
  });
  settings = Object.assign({}, settings, { opening: op });
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
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
  if (range === 'month') {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    return { s: ymd(new Date(y, m, 1)), e: ymd(new Date(y, m + 1, 0)), y, m };
  }
  const y = anchor.getFullYear();
  return { s: `${y}-01-01`, e: `${y}-12-31`, y };
}

function periodLabel(range, p) {
  if (range === 'day') return (p.s === todayStr() ? 'Today · ' : '') + F_FULL.format(parseYmd(p.s));
  if (range === 'week') {
    const a = parseYmd(p.s), b = parseYmd(p.e);
    const left = a.getMonth() === b.getMonth() ? String(a.getDate()) : F_DM.format(a);
    return `${left} – ${F_DM.format(b)} ${F_Y.format(b)}`;
  }
  if (range === 'month') return F_MONTH.format(new Date(p.y, p.m, 1));
  return String(p.y);
}

const isCurrent = p => p.s <= todayStr() && todayStr() <= p.e;
function shiftAnchor(dir) {
  const a = ui.anchor;
  if (dir > 0 && isCurrent(periodOf(ui.range, a))) return;   // no peeking into the future
  if (ui.range === 'day') ui.anchor = addDays(a, dir);
  else if (ui.range === 'week') ui.anchor = addDays(a, 7 * dir);
  else if (ui.range === 'month') ui.anchor = new Date(a.getFullYear(), a.getMonth() + dir, 1);
  else ui.anchor = new Date(a.getFullYear() + dir, a.getMonth(), Math.min(a.getDate(), 28));
}

const sum = (arr, f = x => x.amount) => arr.reduce((s, x) => s + f(x), 0);
function groupSum(arr, keyFn) {
  const m = new Map();
  arr.forEach(x => { const k = keyFn(x); m.set(k, (m.get(k) || 0) + x.amount); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const COMP_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)'];
// part-to-whole: ONE stacked bar + a legend that always names every segment and its value
function compHTML(rows, total) {
  if (!rows.length || !total) return '<div class="empty">No data</div>';
  let list = rows.map(r => [r[0], r[1], false]);
  if (list.length > 6) {
    const rest = list.slice(6);
    list = list.slice(0, 6).concat([[rest.length === 1 ? rest[0][0] : 'Other', rest.reduce((a, r) => a + r[1], 0), true]]);
  }
  const parts = list.map(([name, v, other], i) => {
    const pct = Math.round(v / total * 100);
    return { name, v, pct, color: other ? 'var(--s-other)' : COMP_COLORS[i], tip: `${name} · ${baht(v)} · ${pct}%` };
  });
  const bar = parts.map(p => `<i data-tip="${esc(p.tip)}" style="flex:${p.v};background:${p.color}"></i>`).join('');
  const legend = parts.map(p => `<button type="button" class="lg" data-tip="${esc(p.tip)}"><span class="sw" style="background:${p.color}"></span><span class="nm">${esc(p.name)}</span><span class="pc">${p.pct}%</span><span class="vl">${baht(p.v)}</span></button>`).join('');
  return `<div class="stack">${bar}</div><div class="legend-list">${legend}</div><div class="tip">Tap a segment for details</div>`;
}

function hbRow(name, v, max, cls) {
  const w = max ? Math.max(v / max * 100, v ? 2 : 0) : 0;
  return `<div class="brk"><div class="h"><span>${esc(name)}</span><span>${baht(v)}</span></div><div class="track"><i class="${cls}" style="width:${w}%"></i></div></div>`;
}

/* ---- monthly budget ---- */
function budgets() {
  const b = settings.budgets || {};
  return { total: Number(b.total) || 0, cats: (b.cats && typeof b.cats === 'object') ? b.cats : {} };
}
function progHTML(name, spent, budget) {
  const pct = budget ? spent / budget : 0;
  const cls = pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
  const left = budget - spent;
  const note = left >= 0 ? baht(left) + ' left' : baht(-left) + ' over';
  return `<div class="brk"><div class="h"><span>${esc(name)}</span><span>${baht(spent)} / ${baht(budget)}</span></div>
    <div class="track"><i class="p ${cls}" style="width:${Math.min(pct, 1) * 100}%"></i></div>
    <div class="pnote ${cls}">${Math.round(pct * 100)}% used · ${esc(note)}</div></div>`;
}
function budgetNames() {
  const names = settings.expense.map(x => parseItem(x).name).concat([TRAVEL]);
  Object.keys(budgets().cats).forEach(k => { if (!names.includes(k)) names.push(k); });
  return names;
}
function renderBudget(exp, expSum) {
  const card = $('#budgetCard');
  card.hidden = ui.range !== 'month';
  if (card.hidden) return;
  const b = budgets();
  $('#budEdit').textContent = ui.budEdit ? 'Done' : 'Set budget';
  if (ui.budEdit) {
    const row = (label, key, val) => `<div class="brow"><div class="mid"><div class="t">${esc(label)}</div></div>
      <input class="open-in" type="text" inputmode="decimal" autocomplete="off" placeholder="No limit" data-bud="${esc(key)}" value="${val || ''}" aria-label="Monthly budget for ${esc(label)}"></div>`;
    $('#budBody').innerHTML = row('Total (all spending)', '__total__', b.total) + budgetNames().map(n => row(n, n, b.cats[n])).join('');
    $('#budHint').textContent = 'Monthly limits in baht. Leave a field empty for no limit.';
    return;
  }
  const spentBy = {};
  exp.forEach(t => { const k = t.travel ? TRAVEL : (tn(t.category) || NONE); spentBy[k] = (spentBy[k] || 0) + t.amount; });
  const rows = [];
  if (b.total) rows.push(progHTML('Total', expSum, b.total));
  Object.keys(b.cats).forEach(k => { if (Number(b.cats[k]) > 0) rows.push(progHTML(k, spentBy[k] || 0, Number(b.cats[k]))); });
  $('#budBody').innerHTML = rows.length ? rows.join('') : '<div class="empty">No budget set yet</div>';
  $('#budHint').textContent = rows.length ? '' : 'Tap “Set budget” to add monthly limits per category.';
}
function commitBudget() {
  const cats = {};
  let total = 0;
  $$('#budBody input[data-bud]').forEach(i => {
    const v = parseAmount(i.value);
    if (i.dataset.bud === '__total__') total = v; else if (v > 0) cats[i.dataset.bud] = v;
  });
  settings = Object.assign({}, settings, { budgets: { total, cats } });
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
  sync();
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
  const cur = isCurrent(p);
  $('#nextBtn').disabled = cur;
  $('#todayBtn').hidden = cur;
  $('#sumInc').textContent = baht(incSum);
  $('#sumExp').textContent = baht(expSum);
  $('#sumNet').textContent = baht(net);
  $('.tot.net').classList.toggle('neg', net < 0);

  /* income vs expenses: two bars (day) · bars per day (week) · bars per month (year) */
  const body = $('#chartBody');
  if (ui.range === 'day') {
    $('#chartTitle').textContent = 'Income vs expenses';
    const max = Math.max(incSum, expSum);
    body.innerHTML = hbRow('Income', incSum, max, 'i') + hbRow('Expenses', expSum, max, 'e');
    $('#chartLegend').hidden = true;
    $('#chartTip').textContent = '';
  } else {
    let buckets;
    const t = todayStr();
    if (ui.range === 'week') {
      buckets = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(p.start, i), k = ymd(d);
        return { label: F_W.format(d), full: F_FULL.format(d), cur: k === t,
          e: sum(exp.filter(x => x.date === k)), i: sum(inc.filter(x => x.date === k)) };
      });
      $('#chartTitle').textContent = 'Daily this week';
    } else if (ui.range === 'month') {
      const nd = new Date(p.y, p.m + 1, 0).getDate();
      buckets = Array.from({ length: nd }, (_, i) => {
        const d = new Date(p.y, p.m, i + 1), k = ymd(d), n = i + 1;
        return { label: n === 1 || n % 5 === 0 ? String(n) : '', full: F_FULL.format(d), cur: k === t,
          e: sum(exp.filter(x => x.date === k)), i: sum(inc.filter(x => x.date === k)) };
      });
      $('#chartTitle').textContent = 'Daily this month';
    } else {
      buckets = Array.from({ length: 12 }, (_, m) => {
        const pre = `${p.y}-${pad(m + 1)}`;
        const now = new Date();
        return { label: F_M.format(new Date(p.y, m, 1)), full: F_M.format(new Date(p.y, m, 1)) + ' ' + p.y,
          cur: now.getFullYear() === p.y && now.getMonth() === m,
          e: sum(exp.filter(x => x.date.startsWith(pre))), i: sum(inc.filter(x => x.date.startsWith(pre))) };
      });
      $('#chartTitle').textContent = 'Monthly this year';
    }
    const max = Math.max(1, ...buckets.map(b => Math.max(b.e, b.i)));
    body.innerHTML = '<div class="chart' + (ui.range === 'month' ? ' dense' : '') + '">' + buckets.map(b => {
      const tip = `${b.full} · Spent ${baht(b.e)} · Income ${baht(b.i)}`;
      return `<button type="button" class="col${b.cur ? ' cur' : ''}" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
        <div class="bars"><div class="bar e" style="height:${b.e / max * 100}%"></div><div class="bar i" style="height:${b.i / max * 100}%"></div></div>
        <div class="lb">${esc(b.label)}</div></button>`;
    }).join('') + '</div>';
    $('#chartLegend').hidden = false;
    $('#chartTip').textContent = 'Tap a bar for details';
  }

  renderBudget(exp, expSum);

  /* composition: category / payment method / travel */
  const has = exp.length > 0;
  $('#catCard').hidden = !has;
  $('#splitCard').hidden = !has;
  const travel = exp.filter(t => t.travel);
  $('#travelCard').hidden = !travel.length;
  if (has) {
    $('#splitList').innerHTML = compHTML(groupSum(exp, t => t.method === 'cash' ? 'Cash' : (tn(t.account) || 'Account')), expSum);
    $('#catList').innerHTML = compHTML(groupSum(exp, t => t.travel ? TRAVEL : (tn(t.category) || NONE)), expSum);
  }
  if (travel.length) {
    const ts = sum(travel);
    $('#travelTotal').textContent = baht(ts);
    $('#travelList').innerHTML = compHTML(groupSum(travel, t => tn(t.sub) || 'Other'), ts);
  }

  /* entries (collapsible, at the bottom) / monthly table */
  const dc = $('#detailList');
  $('#detailBody').hidden = !ui.entriesOpen;
  $('#detailToggle').setAttribute('aria-expanded', String(ui.entriesOpen));
  if (ui.range === 'year') {
    $('#detailTitle').textContent = 'Monthly summary';
    let html = '<div class="mrow head"><span>Month</span><span>Income</span><span>Expenses</span><span>Balance</span></div>';
    let any = false;
    for (let m = 0; m < 12; m++) {
      const pre = `${p.y}-${pad(m + 1)}`;
      const mi = sum(inc.filter(x => x.date.startsWith(pre))), me = sum(exp.filter(x => x.date.startsWith(pre)));
      if (!mi && !me) continue;
      any = true;
      html += `<div class="mrow"><span>${esc(F_M.format(new Date(p.y, m, 1)))}</span><span class="i">${money(mi)}</span><span class="e">${money(me)}</span><span>${money(mi - me)}</span></div>`;
    }
    dc.innerHTML = any ? html : '<div class="empty">No entries this year</div>';
  } else {
    $('#detailTitle').textContent = 'Entries (' + inRange.length + ')';
    if (!inRange.length) dc.innerHTML = '<div class="empty">No entries yet</div>';
    else {
      const sorted = sortTx(inRange);
      let html = '', cur = '';
      sorted.forEach(t => {
        if ((ui.range === 'week' || ui.range === 'month') && t.date !== cur) {
          cur = t.date;
          const dayExp = sum(sorted.filter(x => x.date === cur && x.type === 'expense'));
          html += `<div class="dayhead"><span>${esc(F_FULL.format(parseYmd(cur)))}</span><span>${dayExp ? 'Spent ' + baht(dayExp) : ''}</span></div>`;
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
  $('#syncText').textContent = text || ({ ok: 'Synced', busy: 'Syncing', unset: 'Not connected' }[state] || '—');
}
const pendingText = () => queue.length + ' pending';

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
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // text/plain avoids a CORS preflight
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
    const f = await flush();
    if (f === 'auth') { setSync('err', 'Wrong key'); if (manual) toast("Secret key doesn't match Code.gs"); return; }
    if (f === 'err') { setSync('err', 'Server error'); return; }
    if (f === 'net') { setSync('warn', queue.length ? pendingText() : 'Offline'); return; }

    const res = await apiGet(cfg.url, cfg.key);
    if (!res.ok) { setSync('err', res.error === 'unauthorized' ? 'Wrong key' : 'Error'); return; }

    const server = (res.tx || []).map(t => Object.assign({}, t, { amount: Number(t.amount) || 0, travel: Number(t.travel) || 0 }));
    const pendDel = new Set(queue.filter(o => o.op === 'delete').map(o => o.id));
    const ids = new Set(server.map(t => t.id));
    const pendUpd = new Map(queue.filter(o => o.op === 'update').map(o => [o.tx.id, o.tx]));
    tx = server.filter(t => !pendDel.has(t.id)).map(t => pendUpd.has(t.id) ? Object.assign({}, pendUpd.get(t.id)) : t).concat(queue.filter(o => o.op === 'add' && !ids.has(o.tx.id)).map(o => o.tx));
    saveTx();

    const hasPendingSettings = queue.some(o => o.op === 'saveSettings');
    const sv = res.settings || {};
    if (!hasPendingSettings) {
      if (Object.keys(sv).length) {
        const m = migrate(Object.assign({}, DEFAULTS, sv));
        settings = m.s;
        saveSettingsLocal();
        if (m.changed) { queue.push({ op: 'saveSettings', settings }); saveQueue(); await flush(); }
      } else {
        queue.push({ op: 'saveSettings', settings }); saveQueue();   // brand-new sheet → upload defaults
        await flush();
      }
    }
    setSync(queue.length ? 'warn' : 'ok', queue.length ? pendingText() : undefined);
    if (manual) toast('Synced');
  } catch (e) {
    setSync('warn', queue.length ? pendingText() : 'Offline');
    if (manual) toast("Can't connect. Try again.");
  } finally {
    syncing = false;
    render();
  }
}

/* ================= subscriptions ================= */
const subsList = () => Array.isArray(settings.subs) ? settings.subs : [];
const todayDate = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const daysUntil = ymdStr => Math.round((parseYmd(ymdStr) - todayDate()) / 86400000);
function addMonthsDom(d, n, dom) {
  const y = d.getFullYear(), m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(dom, last));
}
function dueText(days, next) {
  if (days < 0) return 'Overdue ' + (-days) + (days === -1 ? ' day' : ' days');
  if (days === 0) return 'Due today';
  if (days === 1) return 'Tomorrow';
  if (days <= 30) return 'in ' + days + ' days';
  return F_DM.format(parseYmd(next));
}
const subAcc = v => v === CASH_KEY ? 'Cash' : (tn(v) || 'Account');
const sortedSubs = () => subsList().slice().sort((a, b) => a.next.localeCompare(b.next));
const dueSubs = () => sortedSubs().filter(x => x.remind >= 0 && daysUntil(x.next) <= x.remind);

function renderSubs() {
  const list = sortedSubs();
  const monthly = list.reduce((s, x) => s + (x.cycle === 'year' ? x.amount / 12 : x.amount), 0);
  $('#subMonth').textContent = baht(Math.round(monthly * 100) / 100) + ' / month';
  $('#subYear').textContent = list.length ? baht(Math.round(monthly * 12 * 100) / 100) + ' / year · ' + list.length + (list.length === 1 ? ' subscription' : ' subscriptions') : '';
  $('#subList').innerHTML = list.length ? list.map(x => {
    const d = daysUntil(x.next);
    const cls = d < 0 ? 'over' : d <= Math.max(x.remind, 0) && x.remind >= 0 ? 'soon' : '';
    return `<div class="srow" data-sub="${esc(x.id)}">
      <div class="mid"><div class="t">${esc(x.name)}</div>
        <div class="s">${x.cycle === 'year' ? 'Yearly' : 'Monthly'} · ${esc(subAcc(x.acc))}${x.cat ? ' · ' + esc(x.cat) : ''}</div></div>
      <div class="sr"><div class="sv">${baht(x.amount)}</div><div class="sd ${cls}">${esc(dueText(d, x.next))}</div></div>
      <button type="button" class="paid" data-paid="${esc(x.id)}">Paid</button>
    </div>`;
  }).join('') : '<div class="empty">No subscriptions yet</div>';
}

function renderDue() {
  const due = dueSubs();
  const b = $('#dueBanner');
  b.hidden = !due.length || ui.page !== 'entry';
  $('#subsDot').hidden = !due.length;
  if (due.length) {
    const parts = due.slice(0, 2).map(x => x.name + ' · ' + dueText(daysUntil(x.next), x.next).toLowerCase());
    b.textContent = parts.join('  |  ') + (due.length > 2 ? '  +' + (due.length - 2) + ' more' : '');
  }
}

function saveSubs(arr) {
  settings = Object.assign({}, settings, { subs: arr });
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
}

function payNow(id) {
  const x = subsList().find(q => q.id === id); if (!x) return;
  const t = {
    id: uid(), date: todayStr(), type: 'expense', amount: x.amount,
    method: x.acc === CASH_KEY ? 'cash' : 'account', account: x.acc === CASH_KEY ? '' : x.acc,
    category: x.cat || NONE, sub: '', note: x.name, travel: 0, createdAt: new Date().toISOString()
  };
  tx.push(t); queue.push({ op: 'add', tx: t }); saveTx();
  const nextD = addMonthsDom(parseYmd(x.next), x.cycle === 'year' ? 12 : 1, x.dom || parseYmd(x.next).getDate());
  saveSubs(subsList().map(q => q.id === id ? Object.assign({}, q, { next: ymd(nextD) }) : q));
  render();
  toast('Recorded ' + baht(x.amount) + ' · next ' + F_DM.format(nextD));
  sync();
}

/* editor */
let sb = null;
function openSub(id) {
  const x = id ? subsList().find(q => q.id === id) : null;
  sb = x ? { id: x.id, name: x.name, amount: String(x.amount), cycle: x.cycle, next: x.next, acc: x.acc, cat: x.cat || '', remind: x.remind }
         : { id: '', name: '', amount: '', cycle: 'month', next: todayStr(), acc: accountNames()[0] || CASH_KEY, cat: '', remind: 3 };
  renderSubEditor();
  $('#subTitle').textContent = x ? 'Edit subscription' : 'New subscription';
  $('#subSheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSub() { $('#subSheet').hidden = true; document.body.style.overflow = ''; sb = null; }
function renderSubEditor() {
  const names = accountNames();
  const accItems = names.map(n => ({ v: n, n })).concat([{ v: CASH_KEY, n: 'Cash' }]);
  if (sb.acc && sb.acc !== CASH_KEY && !names.includes(sb.acc)) accItems.unshift({ v: sb.acc, n: sb.acc });
  const cats = settings.expense.map(x => parseItem(x).name);
  if (sb.cat && !cats.includes(sb.cat)) cats.push(sb.cat);
  const rem = [[-1, 'No reminder'], [0, 'On the day'], [1, '1 day before'], [3, '3 days before'], [7, '7 days before']];
  $('#subBody').innerHTML = `
    <div class="fld">Name</div><input id="sbName" class="edit-in" type="text" autocomplete="off" placeholder="e.g. Netflix" value="${esc(sb.name)}">
    <div class="fld">Amount</div><input id="sbAmt" class="edit-in big" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(sb.amount)}">
    <div class="fld">Billing cycle</div>${chipRow([{ v: 'month', n: 'Monthly' }, { v: 'year', n: 'Yearly' }], sb.cycle, 'scycle')}
    <div class="fld">Next payment date</div><input id="sbDate" class="edit-in" type="date" value="${esc(sb.next)}">
    <div class="fld">Always paid with</div>${chipRow(accItems, sb.acc, 'sacc')}
    <div class="fld">Category (optional)</div>${chipRow(cats.map(n => ({ v: n, n })), sb.cat, 'scat')}
    <div class="fld">Remind me</div>${chipRow(rem.map(([v, n]) => ({ v: String(v), n })), String(sb.remind), 'srem')}
    ${sb.id ? '<button type="button" class="ghost" id="sbCal">Add to Calendar (iPhone reminder)</button><button type="button" class="ghost danger" id="sbDel">Delete subscription</button>' : ''}`;
}
function saveSub() {
  const amt = parseAmount(sb.amount), name = sb.name.trim();
  if (!name) { toast('Enter a name'); return; }
  if (!(amt > 0)) { toast('Enter an amount first'); return; }
  if (!sb.next) { toast('Pick the next payment date'); return; }
  const item = { id: sb.id || uid(), name, amount: amt, cycle: sb.cycle, next: sb.next, dom: parseYmd(sb.next).getDate(), acc: sb.acc, cat: sb.cat, remind: Number(sb.remind) };
  saveSubs(sb.id ? subsList().map(q => q.id === sb.id ? item : q) : subsList().concat([item]));
  closeSub(); render(); toast('Subscription saved'); sync();
}
function deleteSub() {
  if (!confirm('Delete this subscription?\n' + sb.name)) return;
  const id = sb.id;
  saveSubs(subsList().filter(q => q.id !== id));
  closeSub(); render(); toast('Deleted'); sync();
}
function downloadIcs() {
  const x = subsList().find(q => q.id === sb.id); if (!x) return;
  const p = n => String(n).padStart(2, '0');
  const d = parseYmd(x.next);
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const esc2 = t => String(t).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Money//EN', 'BEGIN:VEVENT',
    'UID:' + x.id + '@money-app', 'DTSTAMP:' + stamp + 'T000000Z', 'DTSTART:' + stamp + 'T090000', 'DURATION:PT30M',
    'RRULE:FREQ=' + (x.cycle === 'year' ? 'YEARLY' : 'MONTHLY'),
    'SUMMARY:' + esc2(x.name + ' payment (' + baht(x.amount) + ')'),
    'DESCRIPTION:' + esc2('Paid with ' + subAcc(x.acc))];
  if (x.remind >= 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc2(x.name), 'TRIGGER:' + (x.remind === 0 ? 'PT0S' : '-P' + x.remind + 'D'), 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = x.name.replace(/[^\w-]+/g, '_') + '.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ================= edit entry ================= */
let ed = null;
const editMode = () => ed.travel ? 'travel' : ed.type;
function openEdit(id) {
  const t = tx.find(x => x.id === id); if (!t) return;
  const cat = t.travel ? tn(t.sub) : tn(t.category);
  ed = {
    id, orig: t, type: t.type, travel: !!t.travel, amount: String(t.amount), date: t.date, note: t.note || '',
    category: (cat === NONE || cat === TRAVEL && !t.travel) ? '' : (cat || ''),
    acc: t.method === 'cash' ? CASH_KEY : tn(t.account),
    from: t.method === 'cash' ? CASH_KEY : tn(t.account),
    to: t.sub === TO_CASH ? CASH_KEY : tn(t.sub)
  };
  renderEdit();
  $('#editSheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeEdit() { $('#editSheet').hidden = true; document.body.style.overflow = ''; ed = null; }
function chipRow(items, cur, attr) {
  return `<div class="chips">` + items.map(i => `<button type="button" class="chip${i.v === cur ? ' on' : ''}" data-${attr}="${esc(i.v)}">${esc(i.n)}</button>`).join('') + '</div>';
}
function renderEdit() {
  const mode = editMode();
  $('#editSheet').className = 'sheet mode-' + mode;
  $('#editTitle').textContent = 'Edit ' + mode;
  const names = accountNames();
  const accItems = names.map(n => ({ v: n, n })).concat([{ v: CASH_KEY, n: 'Cash' }]);
  let html = `<div class="fld">Amount</div><input id="edAmt" class="edit-in big" type="text" inputmode="decimal" autocomplete="off" value="${esc(ed.amount)}" aria-label="Amount">`;
  if (mode === 'transfer') {
    const items = [{ v: CASH_KEY, n: 'Cash' }].concat(names.map(n => ({ v: n, n })));
    [ed.from, ed.to].forEach(v => { if (v && v !== CASH_KEY && !names.includes(v)) items.push({ v, n: v }); });
    html += `<div class="fld">From</div>` + chipRow(items, ed.from, 'efrom') + `<div class="fld">To</div>` + chipRow(items, ed.to, 'eto');
  } else {
    if (ed.acc && ed.acc !== CASH_KEY && !names.includes(ed.acc)) accItems.unshift({ v: ed.acc, n: ed.acc });
    const list = listFor(mode).map(x => parseItem(x).name);
    if (ed.category && !list.includes(ed.category)) list.push(ed.category);
    html += `<div class="fld">${mode === 'travel' ? 'Travel type' : 'Category'}</div>` + chipRow(list.map(n => ({ v: n, n })), ed.category, 'ecat');
    html += `<div class="fld">Paid / received via</div>` + chipRow(accItems, ed.acc, 'eacc');
  }
  html += `<div class="fld">Note</div><input id="edNote" class="edit-in" type="text" autocomplete="off" placeholder="Note (optional)" value="${esc(ed.note)}">
    <div class="fld">Date</div><input id="edDate" class="edit-in" type="date" value="${esc(ed.date)}">`;
  $('#editBody').innerHTML = html;
}
function saveEdit() {
  const amt = parseAmount(ed.amount);
  if (!(amt > 0)) { toast('Enter an amount first'); return; }
  const mode = editMode();
  const t = Object.assign({}, ed.orig, { amount: amt, date: ed.date || ed.orig.date, note: ed.note.trim() });
  if (mode === 'transfer') {
    if (!ed.from || !ed.to || ed.from === ed.to) { toast('Pick two different accounts'); return; }
    t.method = ed.from === CASH_KEY ? 'cash' : 'account';
    t.account = ed.from === CASH_KEY ? '' : ed.from;
    t.sub = ed.to === CASH_KEY ? TO_CASH : ed.to;
  } else {
    t.method = ed.acc === CASH_KEY ? 'cash' : 'account';
    t.account = t.method === 'cash' ? '' : ed.acc;
    if (mode === 'travel') { t.category = TRAVEL; t.sub = ed.category; } else { t.category = ed.category || NONE; t.sub = ''; }
  }
  tx = tx.map(x => x.id === t.id ? t : x);
  queueUpdate(t);
  saveTx(); saveQueue();
  closeEdit(); render();
  toast('Saved changes');
  sync();
}

/* ================= settings sheet ================= */
const LIST_KEYS = { accounts: '#edAccounts', expense: '#edExpense', income: '#edIncome', travel: '#edTravel' };
let draft = {};
const cloneLists = src => { const d = {}; Object.keys(LIST_KEYS).forEach(k => { d[k] = (src[k] || []).slice(); }); return d; };
function renderEditor(key) {
  $(LIST_KEYS[key]).innerHTML = draft[key].map((raw, i) =>
    `<span class="chip ed"><span class="nm">${esc(parseItem(raw).name)}</span><button type="button" data-rm="${i}" aria-label="Remove ${esc(parseItem(raw).name)}">×</button></span>`
  ).join('') + '<button type="button" class="chip add" data-add>+ Add new</button>';
}
const renderEditors = () => Object.keys(LIST_KEYS).forEach(renderEditor);
function commitAdd(inp) {
  if (inp.dataset.done) return;
  inp.dataset.done = '1';
  const key = inp.closest('[data-key]').dataset.key;
  const v = inp.value.trim();
  if (v && !draft[key].some(x => parseItem(x).name.toLowerCase() === parseItem(v).name.toLowerCase())) draft[key].push(v);
  else if (v) toast('Already in the list');
  renderEditor(key);
}
function fillLists(src) { draft = cloneLists(src); renderEditors(); }
function openSettings() {
  $('#cfgUrl').value = cfg.url;
  $('#cfgKey').value = cfg.key;
  $('#testMsg').textContent = ''; $('#testMsg').className = 'hint';
  fillLists(settings);
  markSettingsSegs();
  $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSettings() { $('#sheet').hidden = true; document.body.style.overflow = ''; }
function markSettingsSegs() {
  $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === cfg.theme));
  $$('#weekSeg button').forEach(b => b.classList.toggle('on', Number(b.dataset.ws) === cfg.weekStart));
}

async function testConn() {
  const url = $('#cfgUrl').value.trim(), key = $('#cfgKey').value;
  const msg = $('#testMsg');
  if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) { msg.className = 'hint bad'; msg.textContent = 'The URL must start with https://script.google.com/ and end with /exec'; return; }
  msg.className = 'hint'; msg.textContent = 'Testing…';
  try {
    const r = await apiGet(url, key);
    if (r.ok) { msg.className = 'hint ok'; msg.textContent = `Connected ✓ Found ${(r.tx || []).length} entries`; }
    else { msg.className = 'hint bad'; msg.textContent = r.error === 'unauthorized' ? "Secret key doesn't match Code.gs" : 'The server returned an error'; }
  } catch (e) {
    msg.className = 'hint bad';
    msg.textContent = `Can't connect — check the URL, and make sure "Who has access" is set to Anyone when deploying`;
  }
}

function saveSettingsForm() {
  const newUrl = $('#cfgUrl').value.trim(), newKey = $('#cfgKey').value;
  // Connecting (or reconnecting) to a sheet, e.g. after a fresh install: the app only has default lists
  // at that point, so it must PULL the sheet's lists first instead of overwriting them.
  const connChanged = newUrl !== cfg.url || newKey !== cfg.key;
  cfg.url = newUrl;
  cfg.key = newKey;
  saveCfg();
  if (connChanged) {
    closeSettings(); render();
    toast(newUrl ? 'Connecting…' : 'Settings saved');
    sync(true);
    return;
  }
  $$('.chip-input').forEach(commitAdd);
  settings = Object.assign({}, settings, cloneLists(draft));
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
  ui.category = '';
  closeSettings();
  render();
  toast('Settings saved');
  sync();
}

/* ================= navigation / render ================= */
const TITLES = { entry: 'Money', subs: 'Subs', recent: 'Recent', summary: 'Summary', balance: 'Balance' };
function showPage(name) {
  ui.page = name;
  Object.keys(TITLES).forEach(p => { $('#page-' + p).hidden = p !== name; });
  $('#pageTitle').textContent = TITLES[name];
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.page === name));
  $('#recentBtn').classList.toggle('active', name === 'recent');
  if (name !== 'balance') ui.balEdit = false;
  if (name !== 'summary') ui.budEdit = false;
  window.scrollTo(0, 0);
  render();
}
function render() {
  if (ui.page === 'entry') renderEntry();
  else if (ui.page === 'recent') renderRecent();
  else if (ui.page === 'subs') renderSubs();
  else if (ui.page === 'balance') renderBalance();
  else renderSummary();
  renderDue();
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
$('#transferGroup').addEventListener('click', e => {
  const f = e.target.closest('[data-from]'), t = e.target.closest('[data-to]');
  if (f) { ui.from = f.dataset.from; if (ui.to === ui.from) ui.to = ''; renderEntry(); }
  if (t) { ui.to = t.dataset.to; if (ui.from === ui.to) ui.from = ''; renderEntry(); }
});
$('#swapBtn').addEventListener('click', () => { [ui.from, ui.to] = [ui.to, ui.from]; renderEntry(); });
$('#accountRow').addEventListener('click', e => {
  const b = e.target.closest('button[data-acc]'); if (!b) return;
  ui.account = parseItem(settings.accounts[Number(b.dataset.acc)]).name; renderEntry();
});
$('#catChips').addEventListener('click', e => {
  const b = e.target.closest('button[data-cat]'); if (!b) return;
  const name = parseItem(listFor(ui.mode)[Number(b.dataset.cat)]).name;
  ui.category = ui.category === name ? '' : name;
  renderEntry();
});
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
  if (d) { removeTx(d.dataset.del); return; }
  const it = e.target.closest('[data-edit]');
  if (it) { openEdit(it.dataset.edit); return; }
  const t = e.target.closest('[data-tip]');
  if (t) {
    const card = t.closest('.card');
    const tip = card && card.querySelector('.tip');
    if (tip) tip.textContent = t.dataset.tip;
    if (card) $$('.col.sel', card).forEach(x => x.classList.remove('sel'));
    if (t.classList.contains('col')) t.classList.add('sel');
  }
});
$('#detailToggle').addEventListener('click', () => {
  ui.entriesOpen = !ui.entriesOpen; LS.set('entriesOpen', ui.entriesOpen); renderSummary();
});

$$('.tabs button').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
$('#rangeSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-range]'); if (!b) return;
  ui.range = b.dataset.range; ui.budEdit = false; renderSummary();
});
$('#prevBtn').addEventListener('click', () => { shiftAnchor(-1); renderSummary(); });
$('#nextBtn').addEventListener('click', () => { shiftAnchor(1); renderSummary(); });
$('#periodLabel').addEventListener('click', () => { ui.anchor = new Date(); renderSummary(); });
$('#todayBtn').addEventListener('click', () => { ui.anchor = new Date(); renderSummary(); });

$('#settingsBtn').addEventListener('click', openSettings);
$('#setupBtn').addEventListener('click', openSettings);
$('#closeSheet').addEventListener('click', closeSettings);
$('#sheetBg').addEventListener('click', closeSettings);
$('#testBtn').addEventListener('click', testConn);
$('#resetLists').addEventListener('click', () => { fillLists(DEFAULTS); toast('Defaults loaded — tap Save settings'); });
$('#listEditors').addEventListener('click', e => {
  const box = e.target.closest('[data-key]'); if (!box) return;
  const key = box.dataset.key;
  const rm = e.target.closest('[data-rm]');
  if (rm) { draft[key].splice(Number(rm.dataset.rm), 1); renderEditor(key); return; }
  const add = e.target.closest('[data-add]');
  if (add) {
    const inp = document.createElement('input');
    inp.className = 'chip chip-input'; inp.type = 'text'; inp.placeholder = 'Name'; inp.enterKeyHint = 'done';
    inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'New item name');
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    inp.addEventListener('blur', () => commitAdd(inp));
    add.replaceWith(inp); inp.focus();
  }
});
$('#recentBtn').addEventListener('click', () => showPage(ui.page === 'recent' ? 'entry' : 'recent'));
$('#dueBanner').addEventListener('click', () => showPage('subs'));
$('#subAdd').addEventListener('click', () => openSub(''));
$('#subList').addEventListener('click', e => {
  const p = e.target.closest('[data-paid]');
  if (p) { payNow(p.dataset.paid); return; }
  const r = e.target.closest('[data-sub]');
  if (r) openSub(r.dataset.sub);
});
$('#subBody').addEventListener('click', e => {
  if (!sb) return;
  const set = (attr, key, conv) => { const el = e.target.closest('[data-' + attr + ']'); if (!el) return false; sb[key] = conv ? conv(el.dataset[attr]) : el.dataset[attr]; return true; };
  if (e.target.id === 'sbDel') { deleteSub(); return; }
  if (e.target.id === 'sbCal') { downloadIcs(); return; }
  const cat = e.target.closest('[data-scat]');
  if (cat) { sb.cat = sb.cat === cat.dataset.scat ? '' : cat.dataset.scat; renderSubEditor(); return; }
  if (set('scycle', 'cycle') || set('sacc', 'acc') || set('srem', 'remind', Number)) renderSubEditor();
});
$('#subBody').addEventListener('input', e => {
  if (!sb) return;
  if (e.target.id === 'sbName') sb.name = e.target.value;
  else if (e.target.id === 'sbAmt') { const v = e.target.value.replace(/[^\d.,]/g, ''); if (v !== e.target.value) e.target.value = v; sb.amount = v; }
  else if (e.target.id === 'sbDate') sb.next = e.target.value;
});
$('#saveSub').addEventListener('click', saveSub);
$('#closeSub').addEventListener('click', closeSub);
$('#subBg').addEventListener('click', closeSub);
$('#recentSearch').addEventListener('input', e => { ui.q = e.target.value; ui.recentN = 50; renderRecent(); });
$('#editBody').addEventListener('click', e => {
  if (!ed) return;
  const pick = (attr, key) => { const el = e.target.closest('[data-' + attr + ']'); if (!el) return false; ed[key] = el.dataset[attr]; return true; };
  const cat = e.target.closest('[data-ecat]');
  if (cat) { ed.category = ed.category === cat.dataset.ecat ? '' : cat.dataset.ecat; renderEdit(); return; }
  if (pick('eacc', 'acc') || pick('efrom', 'from') || pick('eto', 'to')) renderEdit();
});
$('#editBody').addEventListener('input', e => {
  if (!ed) return;
  if (e.target.id === 'edAmt') { const v = e.target.value.replace(/[^\d.,]/g, ''); if (v !== e.target.value) e.target.value = v; ed.amount = v; }
  else if (e.target.id === 'edNote') ed.note = e.target.value;
  else if (e.target.id === 'edDate') ed.date = e.target.value;
});
$('#saveEdit').addEventListener('click', saveEdit);
$('#closeEdit').addEventListener('click', closeEdit);
$('#editBg').addEventListener('click', closeEdit);
$('#budEdit').addEventListener('click', () => {
  if (ui.budEdit) { commitBudget(); ui.budEdit = false; toast('Budget saved'); }
  else ui.budEdit = true;
  renderSummary();
});
$('#recentMore').addEventListener('click', () => { ui.recentN += 50; renderRecent(); });
$('#balEdit').addEventListener('click', () => {
  if (ui.balEdit) { commitOpening(); ui.balEdit = false; toast('Starting balances saved'); }
  else ui.balEdit = true;
  renderBalance();
});
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
    // app left open overnight → reset the date to today
    if (ui.date < todayStr() && ui.page === 'entry' && !$('#amount').value) ui.date = todayStr();
    sync();
  }
});
window.addEventListener('online', () => sync());

/* ================= no pinch / double-tap zoom ================= */
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const n = Date.now();
  if (n - lastTouchEnd < 300 && !e.target.closest('input, textarea')) e.preventDefault();
  lastTouchEnd = n;
}, { passive: false });

/* ================= sliding glass thumbs ================= */
function syncSegs() {
  $$('.seg, .tabs').forEach(el => {
    if (!el.querySelector(':scope > .thumb')) { const th = document.createElement('span'); th.className = 'thumb'; el.prepend(th); }
    const btns = [...el.children].filter(c => c.tagName === 'BUTTON');
    el.style.setProperty('--n', btns.length);
    const on = btns.findIndex(b => b.classList.contains('on'));
    el.style.setProperty('--i', Math.max(0, on));
    if (el.classList.contains('tabs')) el.classList.toggle('none-on', on < 0);
  });
}
let segRaf;
new MutationObserver(() => { cancelAnimationFrame(segRaf); segRaf = requestAnimationFrame(syncSegs); })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

/* ================= boot ================= */
applyTheme();
render();
syncSegs();
requestAnimationFrame(() => requestAnimationFrame(() => $$('.seg, .tabs').forEach(el => el.classList.add('ready'))));
sizeAmount();
setSync(cfg.url ? (queue.length ? 'warn' : 'ok') : 'unset', cfg.url && queue.length ? pendingText() : undefined);
sync();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
