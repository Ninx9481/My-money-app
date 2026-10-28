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

// date formats follow the app language (Thai uses Gregorian years, not Buddhist)
const mkF = o => { const c = {}; return { format: d => { const l = curLang(); return (c[l] || (c[l] = new Intl.DateTimeFormat(l === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB', o))).format(d); } }; };
const F_FULL = mkF({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const F_DM = mkF({ day: 'numeric', month: 'short' });
const F_M = mkF({ month: 'short' });
const F_W = mkF({ weekday: 'short' });
const F_MONTH = mkF({ month: 'long', year: 'numeric' });
const F_Y = mkF({ year: 'numeric' });

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
  travel: ['🚇 BTS/MRT', '🚕 Taxi/Grab', '🏍️ Motorcycle taxi', '🚌 Bus/Songthaew', '⛽ Fuel', '🛣️ Tolls & parking', '🧳 Other'],
  people: []
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
let cfg = Object.assign({ url: '', key: '', theme: 'auto', lang: 'auto', weekStart: 1, faceLock: false, notify: false }, LS.get('cfg', {}));
/* ---------- language: Thai when the device is Thai (or chosen), otherwise English ---------- */
function curLang() {
  if (cfg.lang === 'th' || cfg.lang === 'en') return cfg.lang;
  const l = (window.__deviceLang || navigator.language || 'en').toLowerCase();
  return l.indexOf('th') === 0 ? 'th' : 'en';
}
const REV = {};   // Thai text -> original, so a tapped chip can be matched back to the stored name
function T(x) {
  if (typeof x !== 'string' || curLang() !== 'th' || !window.I18N) return x;
  const r = window.I18N.tr(x);
  if (r !== x) REV[r] = x;
  return r;
}
const NO_TR = new Set(['id', 'type', 'vk', 'mode', 'method', 'v', 'page', 'step', 'kind', 'action', 'token', 'style', 'sel', 'theme', 'bg', 'colors', 'accent', 'date', 'from', 'to', 'symbol', 'lang', 'tap', 'del', 'move', 'kbd', 'email', 'url', 'key']);
function trDeep(o, k) {
  if (typeof o === 'string') return NO_TR.has(k) ? o : T(o);
  if (Array.isArray(o)) return o.map(x => trDeep(x, k));
  if (o && typeof o === 'object') { const r = {}, raw = o.type === 'field'; for (const kk in o) r[kk] = (raw && kk === 'value') ? o[kk] : trDeep(o[kk], kk); return r; }
  return o;
}
window.T = T; window.curLang = curLang;
// read-only snapshot for the web dashboard widgets (webui.js)
window.LMDATA = () => ({
  bal: balances().map(r => ({ name: r.name, bal: r.bal })), tx: tx.map(t => ({ date: t.date, type: t.type, amount: t.amount, category: t.category, note: t.note, method: t.method, account: t.account })),
  subs: sortedSubs().map(x => ({ name: x.name, amt: curAmt(x), days: daysUntil(x.next), cat: x.cat || '', monthly: isCard(x) ? x.plan[0] : (x.cycle === 'year' ? x.amount / 12 : x.amount) })),
  people: peopleStat().map(p => ({ name: p.name, bal: p.bal })), baht, money
});
const unT = v => (typeof v === 'string' && REV[v] !== undefined) ? REV[v] : v;
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
  recentN: 50, q: '', budEdit: false, budDraft: {}, settingsSub: '',
  balEdit: false,
  accOpen: false, catOpen: false,   // Add page: show every account / category, or only the starred ones
  debtView: 'person',   // Debts tab: By person | By item
  sumView: 'balance'   // the merged Summary tab: Balance | Summary (opens on Balance)
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
// System appearance changed (or the native side dropped its Light/Dark override when switching to Auto):
// the web view only learns the new scheme after the native change, so re-apply and re-send colors to the native UI.
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  applyTheme();
  colorCache = { key: '', v: null };
  pushChrome();
  setTimeout(pushChrome, 150);
});

/* ================= toast ================= */
let toastTimer;
function toast(msg) {
  msg = T(msg);
  const nh = NATIVE && (ui.page === 'entry' || !IOS) && chromeH();
  if (nh) { nh.postMessage({ toast: String(msg) }); return; }   // the Add page is native, so its toast is native too
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
// Starred items (Settings › list › ★) are the only chips the Add page shows until the chevron is tapped.
const favOf = key => ((settings.fav && settings.fav[key]) || []);
function favChips(names, key, selected, open) {
  const fav = favOf(key).filter(n => names.includes(n));
  if (!fav.length) return names;                                   // nothing starred yet → show everything
  const vis = names.filter(n => fav.includes(n) || n === selected); // the picked item stays visible
  if (vis.length === names.length) return names;
  return open ? names.concat('__less__') : vis.concat('__more__');
}
function toggleFav(sub, i) {
  const raw = (draft[sub] || [])[i]; if (raw === undefined) return;
  const name = parseItem(raw).name;
  const cur = favOf(sub).slice();
  const at = cur.indexOf(name);
  if (at >= 0) cur.splice(at, 1); else cur.push(name);
  settings = Object.assign({}, settings, { fav: Object.assign({}, settings.fav || {}, { [sub]: cur }) });
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
  pushChrome();
  sync();
}

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
  $('#setupBanner').hidden = hasBackend();
  pushChrome();
}

function parseAmount(s) {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function addEntry() {
  const amt = parseAmount($('#amount').value);
  if (!(amt > 0)) { toast('Enter an amount first'); if (NATIVE) { entryFocus++; pushChrome(); } else $('#amount').focus(); return; }
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
  entryClear++;
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

function dropTx(id) {
  tx = tx.filter(x => x.id !== id);
  queue = queue.filter(o => !(o.op === 'update' && o.tx.id === id && o !== inflight));
  const i = queue.findIndex(o => o.op === 'add' && o.tx.id === id);
  if (i >= 0 && queue[i] !== inflight) queue.splice(i, 1);
  else queue.push({ op: 'delete', id });
  saveTx(); saveQueue();
}
async function removeTx(id) {
  const t = tx.find(x => x.id === id);
  if (!t) return;
  const label = t.type === 'transfer' ? 'Transfer' : t.travel ? (tn(t.sub) || TRAVEL) : tn(t.category);
  const linked = debtsList().filter(x => x.link === id);   // a split bill: its debts go with it
  const r = await askAlert('Delete this entry?', `${t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '−'}${money(t.amount)} · ${label}` +
    (linked.length ? '\nThis also removes the split with ' + linked.map(x => x.person).join(', ') + '.' : ''),
    [{ id: 'del', title: 'Delete', style: 'destructive' }, { id: 'no', title: 'Cancel', style: 'cancel' }]);
  if (r !== 'del' || !tx.some(x => x.id === id)) return;
  dropTx(id);
  if (linked.length) saveDebts(debtsList().filter(x => x.link !== id));
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

/* ================= debts page (web fallback: a plain list; adding happens in the iPhone app) ================= */
function renderDebtsWeb() {
  if (NATIVE) return;   // the iPhone app draws this page natively; no web content under the glass bars
  const ppl = peopleStat().filter(p => p.bal);
  $('#debtList').innerHTML = ppl.length ? ppl.map(p => `<div class="brow"><div class="mid"><div class="t">${esc(p.name)}</div><div class="s">${p.bal > 0 ? 'Owes you' : 'You owe'}</div></div>
    <div class="bv${p.bal < 0 ? ' neg' : ''}">${baht(Math.abs(p.bal))}</div></div>`).join('') : '<div class="empty">All settled</div>';
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
  debtsList().forEach(e => {   // money lent / borrowed / paid back moves an account too
    const o = Number(e.owed) || 0; if (!o) return;
    const nm = tn(e.acct) || 'Account';
    const r = e.acct === CASH_KEY ? row(CASH_KEY, 'Cash', true) : row(nm, nm, false);
    if (o > 0) r.exp += o; else r.inc += -o;
    if (e.paid && e.paidAcct) {   // settled: the money moved the other way on the account it was paid through
      const pn = tn(e.paidAcct) || 'Account';
      const pr = e.paidAcct === CASH_KEY ? row(CASH_KEY, 'Cash', true) : row(pn, pn, false);
      if (o > 0) pr.inc += o; else pr.exp += -o;
    }
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
  $('#balHint').textContent = 'Balance = starting balance + all income − all expenses. Set starting balances in Settings.';
  $('#balList').innerHTML = list.map(r => {
    const sub = r.editable || r.open ? '' : 'Not in your account list';
    const detail = `In ${baht(r.inc)} · Out ${baht(r.exp)}` + (r.open ? ` · Start ${baht(r.open)}` : '');
    return `<div class="brow"><div class="mid"><div class="t">${esc(r.name)}</div><div class="s">${esc(sub || detail)}</div></div>
      <div class="bv${r.bal < 0 ? ' neg' : ''}">${baht(r.bal)}</div></div>`;
  }).join('');
}

// Starting balances are edited on the Settings page.
let openDraft = {};
function renderOpenList() {
  $$('#openList input[data-open]').forEach(i => { openDraft[i.dataset.open] = i.value; });   // keep what was typed
  const op = openingMap();
  const rows = (draft.accounts || []).map(a => ({ key: parseItem(a).name, name: parseItem(a).name })).concat([{ key: CASH_KEY, name: 'Cash' }]);
  $('#openList').innerHTML = rows.map(r => {
    const v = r.key in openDraft ? openDraft[r.key] : (op[r.key] || '');
    return `<div class="brow"><div class="mid"><div class="t">${esc(r.name)}</div></div>
      <input class="open-in" type="text" inputmode="decimal" autocomplete="off" placeholder="0" data-open="${esc(r.key)}" value="${esc(String(v))}" aria-label="Starting balance for ${esc(r.name)}"></div>`;
  }).join('');
}
function collectOpening() {
  const op = Object.assign({}, openingMap());
  $$('#openList input[data-open]').forEach(i => {
    const v = parseAmount(i.value);
    if (v) op[i.dataset.open] = v; else delete op[i.dataset.open];
  });
  return op;
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
function compParts(rows, total) {
  let list = rows.map(r => [r[0], r[1], false]);
  if (list.length > 6) {
    const rest = list.slice(6);
    list = list.slice(0, 6).concat([[rest.length === 1 ? rest[0][0] : 'Other', rest.reduce((a, r) => a + r[1], 0), true]]);
  }
  return list.map(([name, v, other], i) => {
    const pct = Math.round(v / total * 100);
    return { name, v, pct, other, ci: i, color: other ? 'var(--s-other)' : COMP_COLORS[i], tip: `${name} · ${baht(v)} · ${pct}%` };
  });
}
function compHTML(rows, total) {
  if (!rows.length || !total) return '<div class="empty">No data</div>';
  const parts = compParts(rows, total);
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
    const raw = (ui.budDraft && i.dataset.bud in ui.budDraft) ? ui.budDraft[i.dataset.bud] : i.value;   // the iPhone app keeps typed values in budDraft
    const v = parseAmount(raw);
    if (i.dataset.bud === '__total__') total = v; else if (v > 0) cats[i.dataset.bud] = v;
  });
  settings = Object.assign({}, settings, { budgets: { total, cats } });
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
  sync();
}

/* buckets for the income/expense bar chart (week = days, month = days, year = months) */
function chartData(p, inc, exp) {
  const t = todayStr();
  if (ui.range === 'week') {
    return { title: 'Daily this week', buckets: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(p.start, i), k = ymd(d);
      return { label: F_W.format(d), full: F_FULL.format(d), cur: k === t,
        e: sum(exp.filter(x => x.date === k)), i: sum(inc.filter(x => x.date === k)) };
    }) };
  }
  if (ui.range === 'month') {
    const nd = new Date(p.y, p.m + 1, 0).getDate();
    return { title: 'Daily this month', buckets: Array.from({ length: nd }, (_, i) => {
      const d = new Date(p.y, p.m, i + 1), k = ymd(d), n = i + 1;
      return { label: n === 1 || n % 5 === 0 ? String(n) : '', full: F_FULL.format(d), cur: k === t,
        e: sum(exp.filter(x => x.date === k)), i: sum(inc.filter(x => x.date === k)) };
    }) };
  }
  return { title: 'Monthly this year', buckets: Array.from({ length: 12 }, (_, m) => {
    const pre = `${p.y}-${pad(m + 1)}`;
    const now = new Date();
    return { label: F_M.format(new Date(p.y, m, 1)), full: F_M.format(new Date(p.y, m, 1)) + ' ' + p.y,
      cur: now.getFullYear() === p.y && now.getMonth() === m,
      e: sum(exp.filter(x => x.date.startsWith(pre))), i: sum(inc.filter(x => x.date.startsWith(pre))) };
  }) };
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
    const cd = chartData(p, inc, exp);
    const buckets = cd.buckets;
    $('#chartTitle').textContent = cd.title;
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
let chromeSync = { state: '', text: '' };
function setSync(state, text) {
  const b = $('#syncBtn');
  b.className = 'sync ' + (state === 'ok' ? 'ok' : state === 'busy' ? 'busy' : state === 'warn' ? 'warn' : state === 'err' ? 'err' : '');
  $('#syncText').textContent = text || ({ ok: 'Synced', busy: 'Syncing', unset: 'Not connected' }[state] || '—');
  chromeSync = { state: b.className.replace('sync', '').trim(), text: $('#syncText').textContent };
  if (typeof pushChrome === 'function') pushChrome();
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
    try { res = await backendPost(op); } catch (e) { inflight = null; return 'net'; }
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
  if (!hasBackend()) { setSync('unset'); return; }
  if (syncing) return;
  syncing = true;
  setSync('busy');
  try {
    const f = await flush();
    if (f === 'auth') { setSync('err', fbUser ? 'Sign in again' : 'Wrong key'); if (manual) toast(fbUser ? 'Please sign in again' : "Secret key doesn't match Code.gs"); return; }
    if (f === 'err') { setSync('err', 'Server error'); return; }
    if (f === 'net') { setSync('warn', queue.length ? pendingText() : 'Offline'); return; }

    let res = await backendGet();
    if (!res.ok) { setSync('err', res.error === 'unauthorized' ? (fbUser ? 'Sign in again' : 'Wrong key') : 'Error'); return; }
    if (fbUser && !(res.tx || []).length && !Object.keys(res.settings || {}).length) {
      // a brand-new account: this iPhone's data (e.g. what it last synced from the Google Sheet) becomes its first copy
      await fbPost({ op: 'bulk', txs: tx, settings });
      queue = queue.filter(o => o.op !== 'saveSettings' && o.op !== 'add' && o.op !== 'update'); saveQueue();
      res = await backendGet();
      if (!res.ok) { setSync('err', 'Error'); return; }
      if (manual || tx.length) toast('Uploaded ' + tx.length + ' entries to your account');
    }

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

/* ================= Firebase account (optional backend: when signed in it replaces the Google Sheet) ================= */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBBwjok179Ql1syq_arAk0YjmGcRkbaSM0',
  authDomain: 'lemoney-72d41.firebaseapp.com',
  projectId: 'lemoney-72d41',
  storageBucket: 'lemoney-72d41.firebasestorage.app',
  messagingSenderId: '107744440179',
  appId: '1:107744440179:web:216f82bf336742c048df06'
};
// iOS OAuth client ID from Firebase (GoogleService-Info.plist › CLIENT_ID). Public, not a secret. Empty = Google sign-in hidden.
const GOOGLE_IOS_CLIENT_ID = '107744440179-kfqi280prbun6eiat3ifkr6n6v2s4q89.apps.googleusercontent.com';
let fb = null, fbUser = null, fbReady = false;
const acct = { mode: 'in', step: 'welcome', email: '', pass: '', msg: '', bad: false, busy: false };
// the native welcome / sign-in / create-account screens cover the app until there is an account (or an old Google Sheet link)
const authGate = () => NATIVE && !hasBackend();
// while the saved login is still being restored at launch, behave as connected (no "Not connected" flash)
const hasBackend = () => !!(cfg.url || fbUser || (!fbReady && LS.get('fbWas', false)));
const withTimeout = (p, ms = 15000) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); })]).finally(() => clearTimeout(t)); };
const txOut = t => ({
  id: String(t.id), date: String(t.date || ''), type: (t.type === 'income' || t.type === 'transfer') ? t.type : 'expense',
  amount: Number(t.amount) || 0, method: t.method === 'cash' ? 'cash' : 'account', account: t.account || '', category: t.category || '',
  sub: t.sub || '', note: t.note || '', travel: t.travel ? 1 : 0, createdAt: t.createdAt || new Date().toISOString()
});
const fbDenied = e => !!e && (e.code === 'permission-denied' || e.code === 'unauthenticated');
async function fbPost(op) {
  if (!fb || !fbUser) return { ok: false, error: 'unauthorized' };
  const u = fbUser.uid;
  try {
    if (op.op === 'add' || op.op === 'update') await withTimeout(fb.setDoc(fb.txDoc(u, op.tx.id), txOut(op.tx)));
    else if (op.op === 'delete') await withTimeout(fb.deleteDoc(fb.txDoc(u, op.id)));
    else if (op.op === 'saveSettings') await withTimeout(fb.setDoc(fb.settingsDoc(u), { json: JSON.stringify(op.settings || {}), updatedAt: new Date().toISOString() }));
    else if (op.op === 'bulk') {
      const list = (op.txs || []).map(txOut);
      for (let i = 0; i < list.length; i += 400) {
        const b = fb.writeBatch(fb.db);
        list.slice(i, i + 400).forEach(t => b.set(fb.txDoc(u, t.id), t));
        await withTimeout(b.commit(), 60000);
      }
      if (op.settings) await withTimeout(fb.setDoc(fb.settingsDoc(u), { json: JSON.stringify(op.settings), updatedAt: new Date().toISOString() }), 30000);
    }
    return { ok: true };
  } catch (e) {
    if (fbDenied(e)) return { ok: false, error: 'unauthorized' };
    throw e;
  }
}
async function fbGet() {
  if (!fb || !fbUser) return { ok: false, error: 'unauthorized' };
  const u = fbUser.uid;
  try {
    const [snap, st] = await withTimeout(Promise.all([fb.getDocs(fb.txCol(u)), fb.getDoc(fb.settingsDoc(u))]), 30000);
    const list = []; snap.forEach(d => list.push(d.data()));
    let sv = {}; if (st.exists()) { try { sv = JSON.parse(st.data().json) || {}; } catch (e) { sv = {}; } }
    return { ok: true, tx: list, settings: sv };
  } catch (e) {
    if (fbDenied(e)) return { ok: false, error: 'unauthorized' };
    throw e;
  }
}
const backendGet = () => fbUser ? fbGet() : apiGet(cfg.url, cfg.key);
const backendPost = op => fbUser ? fbPost(op) : apiPost(op);

function fbInit() {
  if (fb || !window.FB) { if (!window.FB) fbReady = true; return; }
  try {
    fb = window.FB.init(FIREBASE_CONFIG);
    fb.onUser(u => {
      const was = !!fbUser;
      fbUser = u ? { uid: u.uid, email: u.email || '' } : null;
      fbReady = true;
      LS.set('fbWas', !!fbUser);
      if (fbUser && !was) { if (cfg.url) { cfg.sheetUrl = cfg.url; cfg.url = ''; saveCfg(); } sync(); }
      render();
    });
  } catch (e) { fb = null; fbReady = true; }
}
function acctMsg(text, bad) { acct.msg = text || ''; acct.bad = !!bad; if (typeof pushChrome === 'function') pushChrome(); }
function fbErrText(e) {
  const c = String((e && e.code) || '');
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Wrong email or password';
  if (/email-already-in-use/.test(c)) return 'This email already has an account. Choose Sign in.';
  if (/weak-password/.test(c)) return 'Password must be at least 6 characters';
  if (/invalid-email/.test(c)) return 'That email address is not valid';
  if (/network/.test(c)) return 'No connection. Try again.';
  if (/too-many/.test(c)) return 'Too many tries. Wait a moment.';
  if (/operation-not-allowed/.test(c)) return 'Email sign-in is not enabled in Firebase yet';
  return 'Something went wrong' + (c ? ' (' + c + ')' : '');
}
async function acctSubmit() {
  if (acct.busy) return;
  if (!fb) { acctMsg('The account service did not load. Restart the app.', true); return; }
  const e = acct.email.trim(), p = acct.pass;
  if (!/^\S+@\S+\.\S+$/.test(e)) { acctMsg('Enter a valid email address', true); return; }
  if (p.length < 6) { acctMsg('Password must be at least 6 characters', true); return; }
  acct.busy = true; acctMsg('Please wait…');
  try {
    if (acct.mode === 'up') await fb.signUp(e, p); else await fb.signIn(e, p);
    acct.pass = ''; acct.msg = '';
    toast(acct.mode === 'up' ? 'Account created' : 'Signed in');
  } catch (err) { acctMsg(fbErrText(err), true); }
  finally { acct.busy = false; if (typeof pushChrome === 'function') pushChrome(); }
}
function acctGoogle() {
  const h = chromeH();
  if (!fb || !NATIVE || !h) { acctMsg('Google sign-in is not available here', true); return; }
  if (acct.busy) return;
  acct.busy = true; acctMsg('');
  h.postMessage({ google: IOS ? { clientId: GOOGLE_IOS_CLIENT_ID } : { fb } });   // the web app signs in with a popup through the Firebase object
}
async function googleResult(idToken, err) {
  if (err) { acct.busy = false; acctMsg(err === 'cancel' ? '' : 'Google sign-in failed (' + err + ')', err !== 'cancel'); return; }
  try {
    if (idToken !== '__done__') await fb.signInGoogle(idToken);   // the web app signs in with a popup and reports '__done__'
    acct.pass = ''; acct.msg = ''; toast('Signed in with Google');
  } catch (e) { acctMsg(/operation-not-allowed/.test(String(e && e.code)) ? 'Google sign-in is not enabled in Firebase yet' : fbErrText(e), true); }
  finally { acct.busy = false; if (typeof pushChrome === 'function') pushChrome(); }
}
async function acctForgot() {
  const e = acct.email.trim();
  if (!fb || !/^\S+@\S+\.\S+$/.test(e)) { acctMsg('Type your email above first', true); return; }
  try { await fb.reset(e); acctMsg('Password reset email sent. Check your inbox.'); }
  catch (err) { acctMsg(fbErrText(err), true); }
}
async function acctSignOut() {
  const pend = queue.length;
  const r = await askAlert('Sign out?', (pend ? pend + ' changes have not synced yet and will be lost. ' : '') + 'Your data stays in your account. It is removed from this iPhone until you sign in again.',
    [{ id: 'ok', title: 'Sign out', style: 'destructive' }, { id: 'no', title: 'Cancel', style: 'cancel' }]);
  if (r !== 'ok') return;
  try { await fb.signOut(); } catch (e) { toast("Couldn't sign out"); return; }
  tx = []; queue = []; settings = migrate(Object.assign({}, DEFAULTS)).s;
  saveTx(); saveQueue(); saveSettingsLocal();
  ui.settingsSub = '';
  acct.step = 'welcome'; acct.msg = ''; acct.pass = '';
  setSync('unset');
  showPage('entry');
  render();
  toast('Signed out');
}
function accountModel(base) {
  const secs = [];
  if (fbUser) {
    secs.push({ header: { title: 'Signed in' }, footer: 'Your entries and settings sync to this account.', rows: [{ type: 'note', text: fbUser.email }] });
    secs.push({ rows: [{ type: 'button', id: 'syncnow', title: 'Sync now', glass: true }] });
    secs.push({ rows: [{ type: 'button', id: 'signout', title: 'Sign out', style: 'danger', glass: true }] });
  } else {
    secs.push({ rows: [{ type: 'seg', id: 'amode', plain: true, sel: acct.mode, items: segItems([['in', 'Sign in'], ['up', 'Create account']]) }] });
    secs.push({ header: { title: 'Email' }, rows: [{ type: 'field', id: 'em', kbd: 'email', value: acct.email, placeholder: 'you@example.com' }] });
    secs.push({ header: { title: 'Password' }, rows: [{ type: 'field', id: 'pw', kbd: 'secure', value: acct.pass, placeholder: 'At least 6 characters' }] });
    const rows = [{ type: 'button', id: 'signin', title: acct.mode === 'up' ? 'Create account' : 'Sign in' }];
    if (GOOGLE_IOS_CLIENT_ID) rows.push({ type: 'button', id: 'google', title: 'Continue with Google' });
    if (acct.mode === 'in') rows.push({ type: 'button', id: 'forgot', title: 'Forgot password?' });
    if (acct.msg) rows.push({ type: 'note', text: acct.msg, nk: acct.bad ? 'bad' : '' });
    secs.push({ footer: cfg.url ? 'Tip: tap the sync button once before signing in, so this iPhone has your latest Google Sheet data. It becomes the first copy in your new account.' : '', rows });
  }
  return Object.assign({ page: 'settings:account', sections: secs }, base);
}

/* ================= backup: export / restore ================= */
const TX_COLS = ['id', 'date', 'type', 'amount', 'method', 'account', 'category', 'sub', 'note', 'travel', 'createdAt'];
const DEBT_COLS = ['id', 'date', 'person', 'owed', 'acct', 'kind', 'note', 'what', 'with', 'cat', 'link', 'paid', 'paidAcct', 'paidDate', 'createdAt'];
const csvCell = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCsv = (rows, cols) => cols.join(',') + '\r\n' + rows.map(x => cols.map(c => csvCell(x[c])).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
function parseCsv(text) {
  const out = []; let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') out.push(row); row = []; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out;
}
function shareFile(name, text, withBom) {
  const body = (withBom ? '﻿' : '') + text;
  const h = chromeH();
  if (NATIVE && h) { h.postMessage({ share: { name, text: body } }); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
const stamp = () => todayStr();
function exportEntries() { shareFile('lemoney-entries-' + stamp() + '.csv', toCsv(tx.slice().sort((p, q) => String(p.date).localeCompare(String(q.date))), TX_COLS), true); }
function exportDebts() {
  const rows = debtsList().map(e => Object.assign({}, e, { with: (e.with || []).join('; '), paid: e.paid ? 1 : 0 }));
  shareFile('lemoney-debts-' + stamp() + '.csv', toCsv(rows, DEBT_COLS), true);
}
function exportBackup() {
  shareFile('lemoney-backup-' + stamp() + '.json', JSON.stringify({ app: 'lemoney', version: 1, exportedAt: new Date().toISOString(), tx, settings }, null, 2), false);
}
function pickBackup() {
  const h = chromeH();
  if (NATIVE && h) h.postMessage({ pick: true });
}
const cleanTx = o => {
  const t = txOutLocal(o);
  return t.id && /^\d{4}-\d{2}-\d{2}/.test(t.date) ? t : null;
};
const txOutLocal = o => ({ id: String(o.id || ''), date: String(o.date || '').slice(0, 10), type: (o.type === 'income' || o.type === 'transfer') ? o.type : 'expense',
  amount: Number(o.amount) || 0, method: o.method === 'cash' ? 'cash' : 'account', account: String(o.account || ''), category: String(o.category || ''),
  sub: String(o.sub || ''), note: String(o.note || ''), travel: Number(o.travel) ? 1 : 0, createdAt: String(o.createdAt || '') });
async function importData(name, text) {
  let list = [], newSettings = null, kind = '';
  const raw = String(text || '').replace(/^﻿/, '').trim();
  try {
    if (raw[0] === '{') {
      const j = JSON.parse(raw);
      if (j.app !== 'lemoney' || !Array.isArray(j.tx)) throw new Error('bad');
      list = j.tx.map(cleanTx).filter(Boolean); newSettings = j.settings && typeof j.settings === 'object' ? j.settings : null; kind = 'backup';
    } else {
      const rows = parseCsv(raw); const head = (rows[0] || []).map(x => x.trim());
      if (!head.includes('id') || !head.includes('date') || !head.includes('amount')) throw new Error('bad');
      kind = 'csv';
      list = rows.slice(1).map(r => { const o = {}; head.forEach((c, i) => { o[c] = r[i]; }); return cleanTx(o); }).filter(Boolean);
    }
  } catch (e) { toast("That file isn't a Lemoney backup or entries CSV"); return; }
  const have = new Set(tx.map(t => t.id));
  const add = list.filter(t => !have.has(t.id));
  const msg = (kind === 'backup' ? 'Backup from the file: ' + list.length + ' entries (' + add.length + ' not here yet).\nYour settings, lists and debts will be replaced by the ones in the file.' : add.length + ' of ' + list.length + ' entries are new and will be added.') + '\nEntries that already exist are kept as they are.';
  const r = await askAlert('Restore from ' + name + '?', msg, [{ id: 'ok', title: 'Restore' }, { id: 'no', title: 'Cancel', style: 'cancel' }]);
  if (r !== 'ok') return;
  if (add.length) {
    tx = tx.concat(add); saveTx();
    if (fbUser) queue.push({ op: 'bulk', txs: add });
    else add.forEach(t => queue.push({ op: 'add', tx: t }));
  }
  if (newSettings) {
    settings = migrate(Object.assign({}, DEFAULTS, newSettings)).s; saveSettingsLocal();
    queue = queue.filter(o => o.op !== 'saveSettings'); queue.push({ op: 'saveSettings', settings });
  }
  saveQueue(); render(); toast('Restored ' + add.length + ' entries'); sync();
}
function backupModel(base) {
  const secs = [];
  secs.push({ header: { title: 'Export' }, footer: 'Opens the iPhone share sheet: save to Files, AirDrop, or send by email. CSV opens in Excel, Numbers or Google Sheets.',
    rows: [{ type: 'button', id: 'ex-tx', title: 'Entries (CSV)', glass: true }, { type: 'button', id: 'ex-debts', title: 'Debts (CSV)', glass: true }] });
  secs.push({ header: { title: 'Full backup' }, footer: 'Everything in one file: entries, accounts, categories, starting balances, budgets, subscriptions, people and debts. Keep a copy somewhere safe.',
    rows: [{ type: 'button', id: 'ex-json', title: 'Save full backup', glass: true }, { type: 'button', id: 'restore', title: 'Restore from file…', glass: true }] });
  return Object.assign({ page: 'settings:backup', sections: secs }, base);
}

/* ================= native iPhone app extras (Capacitor) ================= */
// Only active inside the Capacitor shell; the web/PWA version ignores all of this.
const IOS = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
const NATIVE = IOS || !!window.WEBUI;   // the web app draws the same screens from the same models (webui.js) as the iPhone app does natively
function chromeH() {
  if (window.WEBUI) return { postMessage: m => window.WEBUI.post(m) };
  return window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.chrome;
}
const nat = (plugin, method, opts) => window.Capacitor.nativePromise(plugin, method, opts || {});
let authing = false, hiddenAt = 0, authed = false;
const PROTECTED = { balance: 1, summary: 1 };

function showLock() { $('#lock').hidden = false; pushChrome(); }
function hideLock() { const was = !$('#lock').hidden; $('#lock').hidden = true; if (was) pushChrome(); }
async function unlock() {
  if (authing) return false;
  authing = true;
  try {
    await nat('BiometricAuthNative', 'internalAuthenticate', { reason: 'Unlock Lemoney', allowDeviceCredential: true, cancelTitle: 'Cancel' });
    authed = true;
    hideLock();
    return true;
  } catch (e) { return false; }
  finally { setTimeout(() => { authing = false; }, 400); }
}
// Face ID gate: only Balance and Summary are protected.
function gatePage(name) {
  if (!IOS || !cfg.faceLock || !PROTECTED[name]) { hideLock(); return; }
  if (authed) { hideLock(); return; }
  showLock(); unlock();
}

async function scheduleReminders() {
  if (!IOS) return;
  try {
    const pend = await nat('LocalNotifications', 'getPending');
    const ids = ((pend && pend.notifications) || []).map(n => ({ id: n.id }));
    if (ids.length) await nat('LocalNotifications', 'cancel', { notifications: ids });
    try { await nat('LocalNotifications', 'removeAllDeliveredNotifications'); } catch (e) {}
    if (!cfg.notify) return;
    const out = [];
    const now = Date.now();
    subsList().forEach(x => {
      if (x.remind < 0) return;
      let d = parseYmd(x.next);
      const step = x.cycle === 'year' ? 12 : 1, count = isCard(x) ? x.plan.length : (x.cycle === 'year' ? 3 : 12);
      for (let k = 0; k < count; k++) {
        const amtK = isCard(x) ? x.plan[k] : x.amount;
        const fire = new Date(d.getFullYear(), d.getMonth(), d.getDate() - x.remind, 9, 0, 0);
        if (fire.getTime() > now + 60000) {
          const when = x.remind === 0 ? 'is due today' : x.remind === 1 ? 'is due tomorrow' : 'is due in ' + x.remind + ' days';
          out.push({ title: x.name + ' ' + when, body: baht(amtK) + ' · ' + subAcc(x.acc), schedule: { at: fire, allowWhileIdle: true }, at: fire.getTime() });
        }
        d = addMonthsDom(d, step, x.dom || parseYmd(x.next).getDate());
      }
    });
    out.sort((a, b) => a.at - b.at);
    const list = out.slice(0, 60).map((n, i) => ({ id: i + 1, title: n.title, body: n.body, schedule: n.schedule }));   // iOS keeps at most 64 pending
    if (list.length) await nat('LocalNotifications', 'schedule', { notifications: list });
  } catch (e) { /* ignore */ }
}

function markNativeSegs() {
  $$('#faceSeg button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!cfg.faceLock));
  $$('#notifySeg button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!cfg.notify));
}
async function setFace(on) {
  if (on) {
    const ok = await unlock();
    if (!ok) { toast("Face ID didn't work — lock not enabled"); return; }
    cfg.faceLock = true;
  } else cfg.faceLock = false;
  saveCfg(); markNativeSegs();
}
async function setNotify(on) {
  if (on) {
    try {
      const r = await nat('LocalNotifications', 'requestPermissions');
      if (!r || r.display !== 'granted') { toast('Allow notifications for Money in iPhone Settings'); return; }
    } catch (err) { toast('Notifications unavailable'); return; }
    cfg.notify = true;
  } else cfg.notify = false;
  saveCfg(); markNativeSegs(); scheduleReminders();
}
function initNative() {
  if (!NATIVE) return;
  if (!IOS) { document.body.classList.add('native'); new MutationObserver(pushChrome).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] }); return; }
  $('#nativeSettings').hidden = false;
  markNativeSegs();
  $('#faceSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (b) setFace(b.dataset.v === '1');
  });
  $('#notifySeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (b) setNotify(b.dataset.v === '1');
  });
  $('#unlockBtn').addEventListener('click', unlock);
  document.addEventListener('visibilitychange', () => {
    if (authing) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      if (cfg.faceLock && PROTECTED[ui.page]) showLock();   // hides the content in the app switcher
    } else {
      if (Date.now() - hiddenAt >= 30000) authed = false;
      gatePage(ui.page);
    }
  });
  document.body.classList.add('native');
  new MutationObserver(pushChrome).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  scheduleReminders();
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

const isCard = x => x.kind === 'card' && Array.isArray(x.plan) && x.plan.length > 0;
const curAmt = x => isCard(x) ? x.plan[0] : x.amount;
function renderSubs() {
  const list = sortedSubs();
  const monthly = list.reduce((s, x) => s + (isCard(x) ? x.plan[0] : (x.cycle === 'year' ? x.amount / 12 : x.amount)), 0);
  $('#subMonth').innerHTML = esc(baht(Math.round(monthly * 100) / 100)) + '<span class="per"> / month</span>';
  const cards = list.filter(isCard), subs = list.length - cards.length;
  const left = cards.reduce((s, x) => s + x.plan.reduce((p, v) => p + v, 0), 0);
  const parts = [];
  if (subs) parts.push(subs + (subs === 1 ? ' subscription' : ' subscriptions'));
  if (cards.length) parts.push(cards.length + (cards.length === 1 ? ' card plan' : ' card plans') + ' · ' + baht(Math.round(left * 100) / 100) + ' left');
  $('#subYear').textContent = parts.join(' · ');
  $('#subList').innerHTML = list.length ? list.map(x => {
    const d = daysUntil(x.next);
    const cls = d < 0 ? 'over' : d <= Math.max(x.remind, 0) && x.remind >= 0 ? 'soon' : '';
    const kind = isCard(x) ? 'Credit card · ' + x.plan.length + (x.plan.length === 1 ? ' payment left' : ' payments left') : (x.cycle === 'year' ? 'Yearly' : 'Monthly');
    return `<div class="srow" data-sub="${esc(x.id)}">
      <div class="mid"><div class="t">${esc(x.name)}</div>
        <div class="s">${kind} · ${esc(subAcc(x.acc))}${x.cat ? ' · ' + esc(x.cat) : ''}</div></div>
      <div class="sr"><div class="sv">${baht(curAmt(x))}</div><div class="sd ${cls}">${esc(dueText(d, x.next))}</div></div>
      <button type="button" class="paid" data-paid="${esc(x.id)}">Paid</button>
    </div>`;
  }).join('') : '<div class="empty">Nothing here yet</div>';
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
  setTimeout(scheduleReminders, 0);
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
}

function payNow(id) {
  const x = subsList().find(q => q.id === id); if (!x) return;
  const amt = curAmt(x);
  const t = {
    id: uid(), date: todayStr(), type: 'expense', amount: amt,
    method: x.acc === CASH_KEY ? 'cash' : 'account', account: x.acc === CASH_KEY ? '' : x.acc,
    category: x.cat || NONE, sub: '', note: x.name, travel: 0, createdAt: new Date().toISOString()
  };
  tx.push(t); queue.push({ op: 'add', tx: t }); saveTx();
  const nextD = addMonthsDom(parseYmd(x.next), x.cycle === 'year' ? 12 : 1, x.dom || parseYmd(x.next).getDate());
  if (isCard(x)) {
    const rest = x.plan.slice(1);
    if (!rest.length) {
      saveSubs(subsList().filter(q => q.id !== id));
      render(); toast('Recorded ' + baht(amt) + ' · all installments paid'); sync(); return;
    }
    saveSubs(subsList().map(q => q.id === id ? Object.assign({}, q, { next: ymd(nextD), plan: rest, amount: rest[0] }) : q));
    render(); toast('Recorded ' + baht(amt) + ' · ' + rest.length + ' left · next ' + baht(rest[0]) + ' on ' + F_DM.format(nextD)); sync(); return;
  }
  saveSubs(subsList().map(q => q.id === id ? Object.assign({}, q, { next: ymd(nextD) }) : q));
  render();
  toast('Recorded ' + baht(amt) + ' · next ' + F_DM.format(nextD));
  sync();
}

/* editor */
let sb = null;
function openSub(id) {
  const x = id ? subsList().find(q => q.id === id) : null;
  sb = x ? { id: x.id, kind: isCard(x) ? 'card' : 'sub', name: x.name, amount: String(x.amount), cycle: x.cycle, next: x.next, acc: x.acc, cat: x.cat || '', remind: x.remind,
             plan: isCard(x) ? x.plan.map(String) : [''] }
         : { id: '', kind: 'sub', name: '', amount: '', cycle: 'month', next: todayStr(), acc: accountNames()[0] || CASH_KEY, cat: '', remind: 3, plan: [''] };
  formSession++; subFillVal = '';
  renderSubEditor();
  $('#subSheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSub() { $('#subSheet').hidden = true; document.body.style.overflow = ''; sb = null; pushChrome(); }
function renderSubEditor() {
  const names = accountNames();
  const accItems = names.map(n => ({ v: n, n })).concat([{ v: CASH_KEY, n: 'Cash' }]);
  if (sb.acc && sb.acc !== CASH_KEY && !names.includes(sb.acc)) accItems.unshift({ v: sb.acc, n: sb.acc });
  const cats = settings.expense.map(x => parseItem(x).name);
  if (sb.cat && !cats.includes(sb.cat)) cats.push(sb.cat);
  const rem = [[-1, 'No reminder'], [0, 'On the day'], [1, '1 day before'], [3, '3 days before'], [7, '7 days before']];
  const card = sb.kind === 'card';
  $('#subTitle').textContent = (sb.id ? 'Edit ' : 'New ') + (card ? 'credit card plan' : 'subscription');
  const planHtml = `<div class="fld">Installments left</div>
    <input id="sbN" class="edit-in" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 6" value="${sb.plan.length}">
    <div class="fld">Amount of each installment</div>
    <div class="plan-fill"><input id="sbFill" class="edit-in" type="text" inputmode="decimal" autocomplete="off" placeholder="Same amount for all"><button type="button" class="ghost" id="sbFillBtn">Fill all</button></div>
    <div class="plan">` + sb.plan.map((v, i) => `<div class="plan-row"><span>${i + 1}</span><input class="edit-in" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-plan="${i}" value="${esc(v)}" aria-label="Installment ${i + 1}"></div>`).join('') + `</div>`;
  $('#subBody').innerHTML = `
    <div class="fld">Type</div>${chipRow([{ v: 'sub', n: 'Subscription' }, { v: 'card', n: 'Credit card' }], sb.kind, 'skind')}
    <div class="fld">Name</div><input id="sbName" class="edit-in" type="text" autocomplete="off" placeholder="${card ? 'e.g. iPhone installment' : 'e.g. Netflix'}" value="${esc(sb.name)}">
    ${card ? planHtml : `<div class="fld">Amount</div><input id="sbAmt" class="edit-in big" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(sb.amount)}">
    <div class="fld">Billing cycle</div>${chipRow([{ v: 'month', n: 'Monthly' }, { v: 'year', n: 'Yearly' }], sb.cycle, 'scycle')}`}
    <div class="fld">${card ? 'Next installment date' : 'Next payment date'}</div><input id="sbDate" class="edit-in" type="date" value="${esc(sb.next)}">
    <div class="fld">Always paid with</div>${chipRow(accItems, sb.acc, 'sacc')}
    <div class="fld">Category (optional)</div>${chipRow(cats.map(n => ({ v: n, n })), sb.cat, 'scat')}
    <div class="fld">Remind me</div>${chipRow(rem.map(([v, n]) => ({ v: String(v), n })), String(sb.remind), 'srem')}
    ${sb.id ? '<button type="button" class="ghost" id="sbCal">Add to Calendar (iPhone reminder)</button><button type="button" class="ghost danger" id="sbDel">Delete</button>' : ''}`;
  updateSubAction();
}
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function subComplete() {
  if (!sb || !sb.name.trim() || !sb.next) return false;
  if (sb.kind === 'card') return sb.plan.length > 0 && sb.plan.every(v => parseAmount(v) > 0);
  return parseAmount(sb.amount) > 0;
}
// X while the form is incomplete, a blue tick once it is complete (a native iOS button inside the iPhone app)
function updateSubAction() {
  if (!sb) return;
  const ok = subComplete(), b = $('#closeSub');
  b.classList.toggle('confirm', ok);
  b.innerHTML = ok ? CHECK_SVG : '✕';
  b.setAttribute('aria-label', ok ? 'Add' : 'Close');
  pushChrome();
}
async function subAction() {
  if (!sb) return;
  const noun = sb.kind === 'card' ? 'credit card plan' : 'subscription';
  if (subComplete()) {
    const r = await askAlert(sb.id ? 'Save changes?' : 'Add this ' + noun + '?', sb.name.trim(),
      [{ id: 'ok', title: sb.id ? 'Save' : 'Add', style: 'default' }, { id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
    if (r === 'ok') saveSub(); else if (r === 'discard') closeSub();
  } else {
    const r = await askAlert(sb.id ? 'Discard changes?' : 'Discard this ' + noun + '?', sb.id ? '' : 'It will not be added.',
      [{ id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
    if (r === 'discard') closeSub();
  }
}
function saveSub() {
  const name = sb.name.trim();
  if (!name) { toast('Enter a name'); return; }
  if (!sb.next) { toast('Pick the next payment date'); return; }
  let item;
  if (sb.kind === 'card') {
    applyPlanN();
    const plan = sb.plan.map(parseAmount);
    if (!plan.length || plan.some(v => !(v > 0))) { toast('Enter the amount of every installment'); return; }
    item = { id: sb.id || uid(), kind: 'card', name, amount: plan[0], plan, cycle: 'month', next: sb.next, dom: parseYmd(sb.next).getDate(), acc: sb.acc, cat: sb.cat, remind: Number(sb.remind) };
  } else {
    const amt = parseAmount(sb.amount);
    if (!(amt > 0)) { toast('Enter an amount first'); return; }
    item = { id: sb.id || uid(), name, amount: amt, cycle: sb.cycle, next: sb.next, dom: parseYmd(sb.next).getDate(), acc: sb.acc, cat: sb.cat, remind: Number(sb.remind) };
  }
  saveSubs(sb.id ? subsList().map(q => q.id === sb.id ? item : q) : subsList().concat([item]));
  closeSub(); render(); toast('Subscription saved'); sync();
}
async function deleteSub() {
  const r = await askAlert('Delete this ' + (sb.kind === 'card' ? 'credit card plan' : 'subscription') + '?', sb.name, [{ id: 'del', title: 'Delete', style: 'destructive' }, { id: 'no', title: 'Cancel', style: 'cancel' }]);
  if (r !== 'del' || !sb) return;
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
    'RRULE:FREQ=' + (x.cycle === 'year' ? 'YEARLY' : 'MONTHLY') + (isCard(x) ? ';COUNT=' + x.plan.length : ''),
    'SUMMARY:' + esc2(x.name + ' payment (' + baht(curAmt(x)) + ')'),
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
  formSession++;
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

async function editAction() {
  if (!ed) return;
  if (editComplete()) {
    const r = await askAlert('Save changes?', '', [{ id: 'ok', title: 'Save', style: 'default' }, { id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
    if (r === 'ok') saveEdit(); else if (r === 'discard') closeEdit();
  } else {
    const r = await askAlert('Discard changes?', '', [{ id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
    if (r === 'discard') closeEdit();
  }
}
function sheetAction() {
  if (ie || df) { debtSheetAction(); return; }
  if (sb && !$('#subSheet').hidden) subAction();
  else if (ed && !$('#editSheet').hidden) editAction();
}

/* ================= settings sheet ================= */
const LIST_KEYS = { accounts: '#edAccounts', expense: '#edExpense', income: '#edIncome', travel: '#edTravel', people: '#edPeople' };
let draft = {};
let scrollSeq = 0;
const cloneLists = src => { const d = {}; Object.keys(LIST_KEYS).forEach(k => { d[k] = (src[k] || []).slice(); }); return d; };
function renderEditor(key) {
  $(LIST_KEYS[key]).innerHTML = draft[key].map((raw, i) =>
    `<span class="chip ed"><span class="nm">${esc(parseItem(raw).name)}</span><button type="button" data-rm="${i}" aria-label="Remove ${esc(parseItem(raw).name)}">×</button></span>`
  ).join('') + '<button type="button" class="chip add" data-add>+ Add new</button>';
  if (key === 'accounts') renderOpenList();
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
function fillLists(src) { draft = cloneLists(src); openDraft = {}; renderEditors(); renderOpenList(); }
function openSettings(toConnect) {
  $('#cfgUrl').value = cfg.url;
  $('#cfgKey').value = cfg.key;
  $('#testMsg').textContent = ''; $('#testMsg').className = 'hint';
  fillLists(settings);
  markSettingsSegs();
  ui.settingsSub = toConnect === true ? 'connect' : '';   // the iPhone app shows Connect as its own page
  showPage('settings');
  if (toConnect === true) setTimeout(() => $('#connectSec').scrollIntoView({ block: 'start' }), 0);
}
function closeSettings() { if (ui.page === 'settings') { ui.leaving = true; try { goBack(); } finally { ui.leaving = false; } } }
function markSettingsSegs() {
  $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === cfg.theme));
  $$('#weekSeg button').forEach(b => b.classList.toggle('on', Number(b.dataset.ws) === cfg.weekStart));
}

async function testConn() {
  const url = $('#cfgUrl').value.trim(), key = $('#cfgKey').value;
  const msg = $('#testMsg');
  if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) { msg.className = 'hint bad'; msg.textContent = 'The URL must start with https://script.google.com/ and end with /exec'; pushChrome(); return; }
  msg.className = 'hint'; msg.textContent = 'Testing…'; pushChrome();
  try {
    const r = await apiGet(url, key);
    if (r.ok) { msg.className = 'hint ok'; msg.textContent = `Connected ✓ Found ${(r.tx || []).length} entries`; }
    else { msg.className = 'hint bad'; msg.textContent = r.error === 'unauthorized' ? "Secret key doesn't match Code.gs" : 'The server returned an error'; }
  } catch (e) {
    msg.className = 'hint bad';
    msg.textContent = `Can't connect — check the URL, and make sure "Who has access" is set to Anyone when deploying`;
  }
  pushChrome();
}

function saveSettingsForm() {
  const newUrl = $('#cfgUrl').value.trim(), newKey = $('#cfgKey').value;
  // Connecting (or reconnecting) to a sheet, e.g. after a fresh install: the app only has default lists
  // at that point, so it must PULL the sheet's lists first instead of overwriting them.
  const connChanged = newUrl !== cfg.url || newKey !== cfg.key;
  if (connChanged) {
    cfg.url = newUrl;
    cfg.key = newKey;
    saveCfg();
    closeSettings(); render();
    toast(newUrl ? 'Connecting…' : 'Settings saved');
    sync(true);
    return;
  }
  $$('.chip-input').forEach(commitAdd);
  const newLists = cloneLists(draft), newOpen = collectOpening();
  if (JSON.stringify([cloneLists(settings), openingMap()]) === JSON.stringify([newLists, newOpen])) { closeSettings(); return; }   // nothing changed
  settings = Object.assign({}, settings, newLists, { opening: newOpen });
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


/* ---------- native bars bridge (iPhone app only) ---------- */
function sheetInfo() {
  if (ie) return { title: 'Edit item', action: ieComplete() ? 'confirm' : 'close' };
  if (df) return { title: dfTitle(), action: dfComplete() ? 'confirm' : 'close' };
  if (!$('#subSheet').hidden && sb) return { title: $('#subTitle').textContent, action: subComplete() ? 'confirm' : 'close' };
  if (!$('#editSheet').hidden && ed) return { title: $('#editTitle').textContent, action: editComplete() ? 'confirm' : 'close' };
  return null;
}
function pushChrome() {
  if (!NATIVE) return;
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const h = chromeH();
    if (h) {
      const sheet = sheetInfo();
      const open = $('#lock').hidden;
      h.postMessage(trDeep({
        lang: curLang(),
        page: ui.page, title: settingsTitle(), back: !!SUBPAGE[ui.page],
        tabs: !SUBPAGE[ui.page], due: !$('#subsDot').hidden,
        entry: ui.page === 'entry' ? entryState() : null,
        screen: open ? screenModel() : null,
        form: (open && sheet) ? formModel() : null,
        protect: !!(cfg.faceLock && PROTECTED[ui.page]), lock: !open,
        auth: authGate() ? { step: acct.step, msg: acct.msg, bad: acct.bad, busy: acct.busy, email: acct.email } : null,
        modal: !!document.querySelector('.sheet:not([hidden]):not(#subSheet):not(#editSheet)'),
        sheet,
        sync: chromeSync.state, syncText: chromeSync.text, theme: cfg.theme, bg
      }));
    }
  } catch (e) { /* ignore */ }
}

/* ---------- native Add page: state out, actions in ---------- */
let entryClear = 0, entryFocus = 0, colorCache = { key: '', v: null };
function rgbOf(cssVar) {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;visibility:hidden;background:var(' + cssVar + ')';
  document.body.appendChild(d);
  const c = getComputedStyle(d).backgroundColor;
  d.remove();
  return c;
}
function entryColors() {
  const key = cfg.theme + (matchMedia('(prefers-color-scheme: dark)').matches ? 'd' : 'l');
  if (colorCache.key !== key) {
    colorCache = { key, v: { bg: rgbOf('--bg'), card: rgbOf('--card'), text: rgbOf('--text'), muted: rgbOf('--muted'), chip: rgbOf('--chip'), line: rgbOf('--line'),
      exp: rgbOf('--exp'), inc: rgbOf('--inc'), trv: rgbOf('--trv'), trf: rgbOf('--trf'), s1: rgbOf('--s1'), s2: rgbOf('--s2'), s3: rgbOf('--s3'), s4: rgbOf('--s4'), s5: rgbOf('--s5'), s6: rgbOf('--s6'), so: rgbOf('--s-other'),
      expense: rgbOf('--exp'), income: rgbOf('--inc'), travel: rgbOf('--trv'), transfer: rgbOf('--trf') } };
  }
  return colorCache.v;
}
function entryState() {
  const isTr = ui.mode === 'transfer';
  const names = accountNames();
  const colors = entryColors();
  return {
    mode: ui.mode, method: ui.method,
    accounts: (!isTr && ui.method === 'account' && names.length > 1) ? favChips(names, 'accounts', ui.account, ui.accOpen) : [],
    account: ui.account,
    catLabel: ui.mode === 'travel' ? 'Travel type' : 'Category',
    cats: isTr ? [] : favChips(listFor(ui.mode).map(c => parseItem(c).name), ui.mode, ui.category, ui.catOpen), category: ui.category,
    ends: isTr ? [{ v: CASH_KEY, n: 'Cash' }].concat(names.map(n => ({ v: n, n }))) : [], from: ui.from, to: ui.to,
    date: ui.date, saveTitle: $('#saveBtn').textContent,
    due: !$('#dueBanner').hidden ? $('#dueBanner').textContent : '',
    setup: !hasBackend(), clear: entryClear, focus: entryFocus,
    colors, accent: colors[ui.mode]
  };
}
function entryAction(kind, v) {
  if (kind === 'account' || kind === 'category') v = unT(v);
  switch (kind) {
    case 'mode': ui.mode = v; ui.category = ''; ui.catOpen = false; renderEntry(); break;
    case 'method': ui.method = v; renderEntry(); break;
    case 'account':
      if (v === '__more__' || v === '__less__') { ui.accOpen = v === '__more__'; renderEntry(); break; }
      ui.account = v; ui.accOpen = false; renderEntry(); break;
    case 'category':
      if (v === '__more__' || v === '__less__') { ui.catOpen = v === '__more__'; renderEntry(); break; }
      ui.category = ui.category === v ? '' : v; ui.catOpen = false; renderEntry(); break;
    case 'from': ui.from = v; if (ui.to === ui.from) ui.to = ''; renderEntry(); break;
    case 'to': ui.to = v; if (ui.from === ui.to) ui.from = ''; renderEntry(); break;
    case 'swap': [ui.from, ui.to] = [ui.to, ui.from]; renderEntry(); break;
    case 'date': ui.date = v || todayStr(); break;
    case 'note': $('#note').value = String(v); break;
    case 'amount': $('#amount').value = String(v).replace(/[^\d.,]/g, ''); sizeAmount(); break;
    case 'save': addEntry(); break;
    case 'setup': openSettings(true); break;
    case 'due': showPage('subs'); break;
  }
}


/* ---------- native list screens (Balance, Subs, Recent, Summary, Settings) and form sheets: model out, actions in ---------- */
let screenNonce = 0;
const refreshScreen = () => { screenNonce++; pushChrome(); };   // forces the native side to rebuild (e.g. a switch that must snap back)
const numOnly = v => String(v).replace(/[^\d.,]/g, '');
const segItems = pairs => pairs.map(([v, n]) => ({ v, n }));

function txRow(t, mp) {
  const info = itemInfo(t, mp);
  const end = (cash, name) => cash ? '💵 Cash' : acctIcon(mp, name) + ' ' + (tn(name) || 'Account');
  const way = t.type === 'transfer' ? end(t.method === 'cash', t.account) + ' → ' + end(t.sub === TO_CASH, t.sub) : end(t.method === 'cash', t.account);
  const sign = t.type === 'transfer' ? '' : t.type === 'income' ? '+' : '−';
  return { type: 'row', id: t.id, tap: true, del: t.id, icon: info.icon, title: info.title, sub: [way, t.note].filter(Boolean).join(' · '),
    value: sign + money(t.amount), vk: t.type };
}
// transactions grouped under one header per day (Recent and the Summary entries list)
function daySections(list, all) {
  const mp = maps();
  const groups = [];
  list.forEach(t => {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.date) { g = { date: t.date, items: [] }; groups.push(g); }
    g.items.push(t);
  });
  return groups.map(g => {
    const dayExp = sum(all.filter(x => x.date === g.date && x.type === 'expense'));
    return { header: { title: dateLabel(g.date), trailing: dayExp ? 'Spent ' + baht(dayExp) : '' }, rows: g.items.map(t => txRow(t, mp)) };
  });
}

function summaryModel(colors) {
  const p = periodOf(ui.range, ui.anchor);
  const inRange = tx.filter(t => t.date >= p.s && t.date <= p.e);
  const inc = inRange.filter(t => t.type === 'income');
  const exp = inRange.filter(t => t.type === 'expense');
  const incSum = sum(inc), expSum = sum(exp), net = incSum - expSum;
  const cur = isCurrent(p);
  const secs = [];
  secs.push({ rows: [{ type: 'seg', id: 'range', plain: true, sel: ui.range, items: segItems([['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']]) }] });
  secs.push({ rows: [{ type: 'nav', title: periodLabel(ui.range, p), next: !cur, today: !cur }] });
  secs.push({ rows: [{ type: 'totals', items: [
    { l: 'Income', v: baht(incSum), k: 'inc' }, { l: 'Expenses', v: baht(expSum), k: 'exp' }, { l: 'Balance', v: baht(net), k: net < 0 ? 'neg' : '' }] }] });

  /* income vs expenses */
  if (ui.range === 'day') {
    const max = Math.max(incSum, expSum);
    secs.push({ header: { title: 'Income vs expenses' }, rows: [
      { type: 'bar', title: 'Income', value: baht(incSum), w: max ? incSum / max : 0, k: 'i' },
      { type: 'bar', title: 'Expenses', value: baht(expSum), w: max ? expSum / max : 0, k: 'e' }] });
  } else {
    const cd = chartData(p, inc, exp);
    secs.push({ header: { title: cd.title }, rows: [{ type: 'chart', buckets: cd.buckets.map(b => ({
      l: b.label, e: b.e, i: b.i, cur: !!b.cur, tip: `${b.full} · Spent ${baht(b.e)} · Income ${baht(b.i)}` })) }] });
  }

  /* monthly budget */
  if (ui.range === 'month') {
    const b = budgets();
    const head = { title: 'Monthly budget', action: { id: 'bud', title: ui.budEdit ? 'Done' : 'Set budget' } };
    if (ui.budEdit) {
      const draftOf = (key, val) => key in ui.budDraft ? ui.budDraft[key] : (val ? String(val) : '');
      const field = (label, key, val) => ({ type: 'field', id: 'bud:' + key, title: label, kbd: 'decimal', value: draftOf(key, val), placeholder: 'No limit' });
      secs.push({ header: head, footer: 'Monthly limits in baht. Leave a field empty for no limit.',
        rows: [field('Total (all spending)', '__total__', b.total)].concat(budgetNames().map(n => field(n, n, b.cats[n]))) });
    } else {
      const spentBy = {};
      exp.forEach(t => { const k = t.travel ? TRAVEL : (tn(t.category) || NONE); spentBy[k] = (spentBy[k] || 0) + t.amount; });
      const rows = [];
      const bar = (name, spent, budget) => {
        const pct = budget ? spent / budget : 0;
        const k = pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok';
        const left = budget - spent;
        return { type: 'bar', title: name, value: baht(spent) + ' / ' + baht(budget), w: Math.min(pct, 1), k,
          note: Math.round(pct * 100) + '% used · ' + (left >= 0 ? baht(left) + ' left' : baht(-left) + ' over') };
      };
      if (b.total) rows.push(bar('Total', expSum, b.total));
      Object.keys(b.cats).forEach(k => { if (Number(b.cats[k]) > 0) rows.push(bar(k, spentBy[k] || 0, Number(b.cats[k]))); });
      secs.push(rows.length ? { header: head, rows } : { header: head, footer: 'Tap “Set budget” to add monthly limits per category.', rows: [{ type: 'empty', text: 'No budget set yet' }] });
    }
  }

  /* composition */
  const comp = rows2 => {
    const total = sum(rows2.map(r => ({ amount: r[1] })));
    const parts = compParts(rows2, total);
    return { type: 'stack', parts: parts.map(q => ({ n: q.name, v: baht(q.v), pct: q.pct, c: q.other ? -1 : q.ci, f: q.v })) };
  };
  if (exp.length) {
    secs.push({ header: { title: 'Expenses by category' }, rows: [comp(groupSum(exp, t => t.travel ? TRAVEL : (tn(t.category) || NONE)))] });
    secs.push({ header: { title: 'By payment method' }, rows: [comp(groupSum(exp, t => t.method === 'cash' ? 'Cash' : (tn(t.account) || 'Account')))] });
    const travel = exp.filter(t => t.travel);
    if (travel.length) secs.push({ header: { title: 'Travel', trailing: baht(sum(travel)) }, rows: [comp(groupSum(travel, t => tn(t.sub) || 'Other'))] });
  }

  /* entries (collapsible) / monthly table */
  const open = !!ui.entriesOpen;
  if (ui.range === 'year') {
    secs.push({ rows: [{ type: 'row', id: 'detail', tap: true, title: 'Monthly summary', chevron: open ? 'up' : 'down' }] });
    if (open) {
      const rows = [];
      for (let m = 0; m < 12; m++) {
        const pre = `${p.y}-${pad(m + 1)}`;
        const mi = sum(inc.filter(x => x.date.startsWith(pre))), me = sum(exp.filter(x => x.date.startsWith(pre)));
        if (!mi && !me) continue;
        rows.push({ type: 'row', title: F_M.format(new Date(p.y, m, 1)), sub: 'Income ' + baht(mi) + ' · Expenses ' + baht(me), value: baht(mi - me), vk: (mi - me) < 0 ? 'neg' : '' });
      }
      secs.push({ rows: rows.length ? rows : [{ type: 'empty', text: 'No entries this year' }] });
    }
  } else {
    secs.push({ rows: [{ type: 'row', id: 'detail', tap: true, title: 'Entries (' + inRange.length + ')', chevron: open ? 'up' : 'down' }] });
    if (open) {
      if (!inRange.length) secs.push({ rows: [{ type: 'empty', text: 'No entries yet' }] });
      else {
        const sorted = sortTx(inRange);
        if (ui.range === 'day') secs.push({ rows: sorted.map(t => txRow(t, maps())) });
        else daySections(sorted, sorted).forEach(sc => secs.push(sc));
      }
    }
  }
  return { page: 'summary', colors, nonce: screenNonce, sections: secs };
}

const SETTINGS_LISTS = [['accounts', 'Accounts'], ['expense', 'Expense categories'], ['income', 'Income categories'], ['travel', 'Travel types'], ['people', 'People']];
// pages inside Settings (iPhone app): [full name, short title shown in the top bar]
const SET_SUBS = { open: ['Starting balances', 'Start balances'], accounts: ['Accounts', 'Accounts'], expense: ['Expense categories', 'Expenses'],
  income: ['Income categories', 'Income'], travel: ['Travel types', 'Travel'], people: ['People', 'People'], connect: ['Google Sheet (old)', 'Google Sheet'], account: ['Account', 'Account'], backup: ['Backup & restore', 'Backup'] };
const settingsTitle = () => (ui.page === 'settings' && ui.settingsSub) ? SET_SUBS[ui.settingsSub][1] : (ui.page === 'summary' && ui.sumView === 'balance') ? 'Balance' : (ui.page === 'person') ? personName() : TITLES[ui.page];
function settingsModel(colors) {
  const secs = [];
  const sub = ui.settingsSub;
  const base = { colors, nonce: screenNonce };
  if (!sub) {
    secs.push({ header: { title: 'Account' }, rows: [{ type: 'row', id: 'sub:account', tap: true, title: fbUser ? fbUser.email : 'Sign in or create account', value: '', vk: 'muted', chevron: 'right', light: true }] });
    secs.push({ header: { title: 'Theme' }, footer: IOS ? "Auto follows your iPhone. The iPhone status bar (clock, battery) always follows the iPhone's own appearance, so Auto keeps everything in sync." : 'Auto follows your device.',
      rows: [{ type: 'seg', id: 'theme', plain: true, sel: cfg.theme, items: segItems([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]) }] });
    secs.push({ header: { title: 'Language' }, rows: [{ type: 'seg', id: 'lang', plain: true, sel: cfg.lang, items: segItems([['auto', 'Auto'], ['en', 'English'], ['th', 'ไทย']]) }] });
    secs.push({ header: { title: 'Week starts on' }, rows: [{ type: 'seg', id: 'week', plain: true, sel: String(cfg.weekStart), items: segItems([['1', 'Monday'], ['0', 'Sunday']]) }] });
    if (IOS) {
      secs.push({ header: { title: 'iPhone app' }, footer: 'Ask for Face ID (or your passcode) when you open Balance or Summary. It stays unlocked until you leave the app for more than 30 seconds.',
      rows: [{ type: 'switch', id: 'face', title: 'Face ID lock', on: !!cfg.faceLock }] });
  secs.push({ footer: 'Sends an iPhone notification at 9:00 before each subscription is due, using the reminder you set for it.',
      rows: [{ type: 'switch', id: 'notify', title: 'Subscription reminders', on: !!cfg.notify }] });
    }
    const nav = (key, value) => ({ type: 'row', id: 'sub:' + key, tap: true, title: SET_SUBS[key][0], value, vk: 'muted', chevron: 'right', light: true });
    const nOpen = Object.keys(openingMap()).filter(k => Number(openingMap()[k])).length;
    secs.push({ header: { title: 'Your data' }, rows: [nav('open', nOpen ? String(nOpen) : '')].concat(SETTINGS_LISTS.map(([key]) => nav(key, String((draft[key] || []).length)))) });
    secs.push({ rows: [nav('backup', '')] });
    if (!fbUser) secs.push({ rows: [nav('connect', cfg.url ? 'Connected' : 'Not set')] });
    return Object.assign({ page: 'settings', sections: secs }, base);
  }
  if (sub === 'open') {
    const op = openingMap();
    const accRows = (draft.accounts || []).map(a => ({ key: parseItem(a).name, name: parseItem(a).name })).concat([{ key: CASH_KEY, name: 'Cash' }]);
    secs.push({ footer: 'How much each account already held before your first entry here. Balance = starting balance + income − expenses.',
      rows: accRows.map(r => ({ type: 'field', id: 'open:' + r.key, title: r.name, kbd: 'decimal', placeholder: '0',
        value: String(r.key in openDraft ? openDraft[r.key] : (op[r.key] || '')) })) });
    secs.push({ rows: [{ type: 'button', id: 'reset', title: 'Reset starting balances', style: 'danger' }] });
    return Object.assign({ page: 'settings:open', sections: secs }, base);
  }
  if (sub === 'account') return accountModel(base);
  if (sub === 'backup') return backupModel(base);
  if (sub === 'connect') {
    const msg = $('#testMsg').textContent;
    const rows = [
      { type: 'field', id: 'url', stack: true, title: 'Web app URL (ends with /exec)', kbd: 'url', value: $('#cfgUrl').value, placeholder: 'https://script.google.com/macros/s/.../exec' },
      { type: 'field', id: 'key', stack: true, title: 'Secret key', kbd: 'secure', value: $('#cfgKey').value, placeholder: 'Same as SECRET in Code.gs' },
      { type: 'button', id: 'test', title: 'Test connection' }
    ];
    if (msg) rows.push({ type: 'note', text: msg, nk: $('#testMsg').classList.contains('ok') ? 'ok' : $('#testMsg').classList.contains('bad') ? 'bad' : '' });
    secs.push({ footer: 'Only needed the first time you open the app.', rows });
    return Object.assign({ page: 'settings:connect', sections: secs }, base);
  }
  // a list: drag the handles to reorder, tap − to remove
  const starable = sub === 'accounts' || sub === 'expense' || sub === 'income' || sub === 'travel';
  const rows = (draft[sub] || []).map((raw, i) => {
    const r = { type: 'row', icon: parseItem(raw).icon, title: parseItem(raw).name, del: 'li:' + sub + ':' + i, move: sub };
    if (starable) r.button = { id: 'fav:' + sub + ':' + i, symbol: favOf(sub).includes(parseItem(raw).name) ? 'star.fill' : 'star', on: favOf(sub).includes(parseItem(raw).name) };
    return r;
  });
  rows.push({ type: 'field', id: 'add:' + sub, commit: true, kbd: 'text', placeholder: 'Add new…', value: '' });
  secs.push({ footer: (starable ? 'Tap ★ to pin favorites: the Add page shows only starred ones, with a chevron to reveal the rest. ' : '') + 'Drag ≡ to change the order, tap − to remove. Emoji in your Google Sheet lists are kept and shown next to entries, never in the pickers.', rows });
  secs.push({ rows: [{ type: 'button', id: 'reset', title: 'Reset to defaults', style: 'danger' }] });
  return Object.assign({ page: 'settings:' + sub, sections: secs, edit: true }, base);
}

async function resetSub() {
  const sub = ui.settingsSub; if (!sub || !SET_SUBS[sub]) return;
  const isOpen = sub === 'open';
  const r = await askAlert('Reset ' + SET_SUBS[sub][0].toLowerCase() + '?', isOpen ? 'Every starting balance goes back to 0.' : 'This list goes back to the default items.',
    [{ id: 'ok', title: 'Reset', style: 'destructive' }, { id: 'no', title: 'Cancel', style: 'cancel' }]);
  if (r !== 'ok') return;
  if (isOpen) { $$('#openList input[data-open]').forEach(i => { i.value = ''; openDraft[i.dataset.open] = ''; }); Object.keys(openDraft).forEach(k => { openDraft[k] = ''; }); }
  else if (DEFAULTS[sub]) { draft[sub] = DEFAULTS[sub].slice(); renderEditor(sub); }
  toast('Reset — go back to save');
  pushChrome();
}

async function showSubDetail(id) {
  const x = subsList().find(q => q.id === id); if (!x) return;
  const d = daysUntil(x.next);
  const lines = [];
  if (isCard(x)) {
    const left = Math.round(x.plan.reduce((p, v) => p + v, 0) * 100) / 100;
    lines.push('Credit card · ' + x.plan.length + (x.plan.length === 1 ? ' payment left' : ' payments left'), 'Next installment  ' + baht(x.plan[0]), 'Total left  ' + baht(left));
  } else lines.push((x.cycle === 'year' ? 'Yearly' : 'Monthly') + ' · ' + baht(x.amount));
  lines.push('Paid with  ' + subAcc(x.acc));
  if (x.cat) lines.push('Category  ' + x.cat);
  lines.push('Next  ' + F_FULL.format(parseYmd(x.next)) + ' (' + dueText(d, x.next).toLowerCase() + ')');
  lines.push('Reminder  ' + (x.remind < 0 ? 'none' : x.remind === 0 ? 'on the day' : x.remind + (x.remind === 1 ? ' day before' : ' days before')));
  const r = await askAlert(x.name, lines.join('\n'), [{ id: 'edit', title: 'Edit', style: 'default' }, { id: 'close', title: 'Close', style: 'cancel' }]);
  if (r === 'edit') openSub(id);
}

function showBalanceDetail(key) {
  const r = balances().find(x => x.key === key); if (!r) return;
  const lines = [];
  if (r.open) lines.push('Start  ' + baht(r.open));
  lines.push('In  ' + baht(r.inc), 'Out  ' + baht(r.exp), 'Balance  ' + baht(r.bal));
  askAlert(r.name, lines.join('\n'), [{ id: 'ok', title: 'Close', style: 'cancel' }]);
}

/* ================= debts: lending, borrowing, split bills (iPhone app) =================
   One ledger in settings.debts (so it syncs with the other settings, no Code.gs change).
   item = { id, date, person, owed, acct, kind, note, what, with, cat, link, paid, paidAcct, paidDate, createdAt }
   owed = what the person owes YOU for this item (negative: you owe them). The account you paid from / received into always moves by −owed.
   Marking an item paid takes it out of the person's total and moves money (+owed) on paidAcct.
   A split bill is a normal expense for YOUR share (id = link) plus one item per friend. */
function debtsList() { return Array.isArray(settings.debts) ? settings.debts : []; }
const r2 = n => Math.round(n * 100) / 100;
const pkey = n => String(n || '').trim().toLowerCase();
const ME = '__me__';
function saveDebts(arr) {
  settings = Object.assign({}, settings, { debts: arr });
  saveSettingsLocal();
  queue = queue.filter(o => o.op !== 'saveSettings');
  queue.push({ op: 'saveSettings', settings });
  saveQueue();
}
function peopleStat() {
  const m = new Map();
  debtsList().slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt))).forEach(e => {
    const k = pkey(e.person); if (!k) return;
    if (!m.has(k)) m.set(k, { key: k, name: String(e.person).trim(), bal: 0, entries: [] });
    const p = m.get(k); if (!e.paid) p.bal += Number(e.owed) || 0; p.entries.push(e);
  });
  m.forEach(p => { p.bal = r2(p.bal); });
  return [...m.values()];
}
// people saved in Settings first, then anyone who only appears in the ledger
function allPeople(extra) {
  const out = [];
  const add = n => { const t = String(n || '').trim(); if (t && !out.some(x => pkey(x) === pkey(t))) out.push(t); };
  (Array.isArray(settings.people) ? settings.people : []).forEach(add);
  peopleStat().forEach(p => add(p.name));
  (extra || []).forEach(add);
  return out;
}
const canonName = n => { const k = pkey(n), hit = allPeople().find(x => pkey(x) === k); return hit || String(n).trim(); };
function debtLabel(e) {
  if (e.kind === 'lend') return 'Lent';
  if (e.kind === 'borrow') return 'Borrowed';
  if (e.kind === 'split') return e.owed > 0 ? 'Split bill · you paid' : 'Split bill · they paid';
  if (e.kind === 'pay') return e.owed < 0 ? 'Paid you back' : 'You paid back';
  return 'Entry';
}
const itemTitle = e => e.what || debtLabel(e);
const itemSub = e => [e.what ? debtLabel(e) : '', e.with && e.with.length ? 'with ' + e.with.join(', ') : '', e.acct === CASH_KEY ? 'Cash' : tn(e.acct)].filter(Boolean).join(' · ');
const isItem = e => e.kind !== 'pay';   // 'pay' rows only exist from the first version of Debts

function debtsModel(colors) {
  const ppl = peopleStat();
  const to = ppl.filter(p => p.bal > 0).sort((a, b) => b.bal - a.bal), owe = ppl.filter(p => p.bal < 0).sort((a, b) => a.bal - b.bal);
  const done = ppl.filter(p => !p.bal).sort((a, b) => a.name.localeCompare(b.name));
  const totTo = r2(to.reduce((s, p) => s + p.bal, 0)), totOwe = r2(owe.reduce((s, p) => s - p.bal, 0));
  const rowOf = (p, k) => ({ type: 'row', id: 'p:' + p.key, tap: true, title: p.name, value: k === 'muted' ? 'Settled' : baht(Math.abs(p.bal)), vk: k, chevron: 'right' });
  const hero = { rows: [{ type: 'hero', small: 'Owed to you', big: baht(totTo), sub: totOwe ? 'You owe ' + baht(totOwe) : (ppl.some(p => p.bal) ? '' : 'All settled') }] };
  const viewSeg = { rows: [{ type: 'seg', id: 'dview', plain: true, sel: ui.debtView, items: segItems([['person', 'By person'], ['item', 'By item']]) }] };
  if (ui.debtView === 'item') {
    const all = debtsList().filter(isItem).slice().sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
    const mk = e => ({ type: 'row', id: 'i:' + e.id, tap: true, title: pkeyName(e.person) + ' · ' + itemTitle(e), sub: itemSub(e), value: baht(Math.abs(e.owed)),
      vk: e.paid ? 'muted' : e.owed > 0 ? 'income' : 'expense', caption: e.paid ? 'Paid' + (e.paidDate ? ' · ' + F_DM.format(parseYmd(e.paidDate)) : '') : '' });
    const group = list => { const days = []; list.forEach(e => { let g = days[days.length - 1]; if (!g || g.date !== e.date) { g = { date: e.date, items: [] }; days.push(g); } g.items.push(e); }); return days; };
    const isec = [hero, viewSeg, { header: { title: 'Items', action: { id: 'add', title: '+ Add' } }, rows: [] }];
    const open = all.filter(e => !e.paid), paid = all.filter(e => e.paid).slice(0, 30);
    if (!open.length) isec.push({ header: { title: 'Unpaid' }, rows: [{ type: 'empty', text: 'No unpaid items' }] });
    group(open).forEach(g => isec.push({ header: { title: dateLabel(g.date) }, rows: g.items.map(mk) }));
    if (paid.length) {
      group(paid).forEach((g, i) => isec.push({ header: { title: (i === 0 ? 'Paid · ' : '') + dateLabel(g.date) }, rows: g.items.map(mk) }));
    }
    isec.push({ footer: 'Tap an item to mark it paid, edit its amount or delete it.', rows: [] });
    return { page: 'debts-item', colors, sections: isec };
  }
  const secs = [
    hero, viewSeg,
    { header: { title: 'Owed to you', action: { id: 'add', title: '+ Add' } }, rows: to.length ? to.map(p => rowOf(p, 'income')) : [{ type: 'empty', text: 'Nobody owes you right now' }] },
    { header: { title: 'You owe' }, footer: 'Tap a person to see what it is for, mark items paid or edit them. Use “+ Add” for a loan or a split bill.',
      rows: owe.length ? owe.map(p => rowOf(p, 'expense')) : [{ type: 'empty', text: 'You owe nobody right now' }] }
  ];
  if (done.length) secs.push({ header: { title: 'Settled' }, rows: done.map(p => rowOf(p, 'muted')) });
  return { page: 'debts', colors, sections: secs };
}

/* ---- one person's page ---- */
function personModel(colors) {
  const p = peopleStat().find(x => x.key === ui.person);
  if (!p) return { page: 'person', colors, sections: [{ rows: [{ type: 'empty', text: 'Nothing here' }] }] };
  const unpaid = p.entries.filter(e => !e.paid && isItem(e));
  const secs = [{ rows: [{ type: 'hero', small: p.bal > 0 ? 'Owes you' : p.bal < 0 ? 'You owe' : 'All settled', big: baht(Math.abs(p.bal)), sub: unpaid.length ? unpaid.length + (unpaid.length === 1 ? ' unpaid item' : ' unpaid items') : '' }] }];
  if (unpaid.length) secs.push({ rows: [{ type: 'button', id: 'paidall', title: 'Paid all' }] });
  const days = [];
  p.entries.slice().reverse().forEach(e => {
    let g = days[days.length - 1];
    if (!g || g.date !== e.date) { g = { date: e.date, items: [] }; days.push(g); }
    g.items.push(e);
  });
  days.forEach(g => secs.push({ header: { title: dateLabel(g.date) }, rows: g.items.map(e => ({
    type: 'row', id: e.id, tap: true, title: itemTitle(e), sub: itemSub(e), value: baht(Math.abs(e.owed)),
    vk: e.paid ? 'muted' : e.owed > 0 ? 'income' : 'expense', caption: e.paid ? 'Paid' + (e.paidDate ? ' · ' + F_DM.format(parseYmd(e.paidDate)) : '') : '' })) }));
  secs.push({ footer: 'Tap an item to mark it paid, edit its amount or delete it.', rows: [] });
  return { page: 'person-' + p.key, colors, sections: secs };
}
function personName() { const p = peopleStat().find(x => x.key === ui.person); return p ? p.name : 'Person'; }
function openPersonPage(key) { ui.person = key; showPage('person'); }
async function showItemDetail(id) {
  const e = debtsList().find(x => x.id === id); if (!e) return;
  const lines = [pkeyName(e.person) + (e.owed > 0 ? ' owes you ' : ' — you owe ') + baht(Math.abs(e.owed)), F_FULL.format(parseYmd(e.date))];
  if (e.with && e.with.length) lines.push('Shared with ' + e.with.join(', '));
  lines.push((e.owed > 0 ? 'Paid from ' : 'Received in ') + (e.acct === CASH_KEY ? 'Cash' : tn(e.acct) || 'Account'));
  if (e.paid) lines.push('Paid' + (e.paidDate ? ' on ' + F_DM.format(parseYmd(e.paidDate)) : '') + (e.paidAcct ? ' · ' + (e.paidAcct === CASH_KEY ? 'Cash' : tn(e.paidAcct)) : ''));
  const btns = [];
  if (isItem(e)) btns.push(e.paid ? { id: 'unpaid', title: 'Mark unpaid', style: 'default' } : { id: 'paid', title: 'Paid', style: 'default' });
  btns.push({ id: 'edit', title: 'Edit', style: 'default' }, { id: 'close', title: 'Cancel', style: 'cancel' });
  const r = await askAlert(itemTitle(e), lines.join('\n'), btns);
  if (r === 'paid') openPayForm([id]);
  else if (r === 'unpaid') { saveDebts(debtsList().map(x => x.id === id ? Object.assign({}, x, { paid: false, paidAcct: '', paidDate: '' }) : x)); render(); sync(); toast('Marked unpaid'); }
  else if (r === 'edit') openItemEdit(id);
}
const pkeyName = n => canonName(n);

/* ---- edit one item (amount, note, date) ---- */
let ie = null;
function openItemEdit(id) {
  const e = debtsList().find(x => x.id === id); if (!e) return;
  ie = { id, amount: String(Math.abs(e.owed)), note: e.note || '', date: e.date }; formSession++; pushChrome();
}
function itemForm() {
  const e = debtsList().find(x => x.id === ie.id);
  const secs = [
    { header: { title: 'Amount' }, footer: e && e.kind === 'split' ? (e.owed > 0 ? 'Changing it moves the difference to or from your own share of the bill.' : 'Your share of the bill changes with it.') : '',
      rows: [{ type: 'field', id: 'iamt', big: true, kbd: 'decimal', value: ie.amount, placeholder: '0.00' }] },
    { header: { title: 'Note' }, rows: [{ type: 'field', id: 'inote', kbd: 'text', value: ie.note, placeholder: 'What was it? e.g. Karaoke' }] },
    { rows: [{ type: 'date', id: 'idate', title: 'Date', value: ie.date }] }
  ];
  const last = [];
  if (e && e.paid && isItem(e)) last.push({ type: 'button', id: 'iunpaid', title: 'Mark unpaid' });
  last.push({ type: 'button', id: 'idel', title: 'Delete this item', style: 'danger' });
  secs.push({ rows: last });
  return { page: 'form-item-' + formSession, colors: formColors('trv'), nonce: screenNonce, sections: secs };
}
const ieComplete = () => !!ie && parseAmount(ie.amount) > 0;
function ieAction(kind, v) {
  const o = (v && typeof v === 'object') ? v : {};
  if (kind === 'field') {
    if (o.id === 'iamt') ie.amount = numOnly(String(o.v)); else if (o.id === 'inote') ie.note = String(o.v); else if (o.id === 'idate') ie.date = String(o.v);
  } else if (kind === 'button') {
    if (v === 'idel') deleteItem(ie.id);
    else if (v === 'iunpaid') { const id = ie.id; saveDebts(debtsList().map(x => x.id === id ? Object.assign({}, x, { paid: false, paidAcct: '', paidDate: '' }) : x)); ie = null; render(); sync(); toast('Marked unpaid'); }
  }
}
function setTxAmount(link, amount, mk) {
  const t = tx.find(x => x.id === link), a = r2(amount);
  if (t) { if (a > 0) { const n = Object.assign({}, t, { amount: a }); tx = tx.map(x => x.id === link ? n : x); queueUpdate(n); } else dropTx(link); }
  else if (a > 0 && mk) { const n = Object.assign({ id: link, amount: a }, mk); tx.push(n); queue.push({ op: 'add', tx: n }); }
  saveTx(); saveQueue();
}
function saveItemEdit() {
  const e = debtsList().find(x => x.id === ie.id); if (!e || !ieComplete()) { ie = null; pushChrome(); return; }
  const amt = parseAmount(ie.amount), nowOwed = (e.owed < 0 ? -1 : 1) * amt, delta = r2(nowOwed - e.owed);
  const note = ie.note.trim(), date = ie.date || e.date;
  if (e.kind === 'split' && e.link) {
    const t = tx.find(x => x.id === e.link);
    const mineNow = t ? t.amount : 0;
    const mineNext = e.owed > 0 ? r2(mineNow - delta) : amt;   // you paid: the friend's change lands on your share · they paid: your share is this amount
    if (mineNext < 0) { toast('That is more than the bill'); return; }
    const cash = e.acct === CASH_KEY;
    setTxAmount(e.link, mineNext, { date, type: 'expense', method: cash ? 'cash' : 'account', account: cash ? '' : e.acct, category: e.cat || NONE, sub: '', note: note || 'Split bill', travel: 0, createdAt: new Date().toISOString() });
    if (date !== e.date && tx.some(x => x.id === e.link)) { const n = Object.assign({}, tx.find(x => x.id === e.link), { date }); tx = tx.map(x => x.id === e.link ? n : x); queueUpdate(n); saveTx(); saveQueue(); }
  }
  saveDebts(debtsList().map(x => x.id === e.id ? Object.assign({}, x, { owed: nowOwed, note, what: note || x.cat || '', date }) : x));
  ie = null; render(); toast('Saved'); sync();
}
async function deleteItem(id) {
  const e = debtsList().find(x => x.id === id); if (!e) return;
  const t = e.link ? tx.find(x => x.id === e.link) : null;
  const friendPaid = e.kind === 'split' && e.owed < 0;
  const msg = friendPaid ? 'This removes the split and your share of it from your expenses.'
    : (e.kind === 'split' && e.owed > 0) ? baht(e.owed) + ' will count as your own share of the bill.'
    : 'This removes ' + baht(Math.abs(e.owed)) + ' and moves it out of ' + (e.acct === CASH_KEY ? 'Cash' : tn(e.acct) || 'the account') + ' as if it never happened.';
  const r = await askAlert('Delete this item?', msg, [{ id: 'del', title: 'Delete', style: 'destructive' }, { id: 'no', title: 'Cancel', style: 'cancel' }]);
  if (r !== 'del') return;
  if (e.kind === 'split' && e.link) {
    if (friendPaid) { if (t) dropTx(t.id); }
    else if (e.owed > 0) { const cash = e.acct === CASH_KEY;
      setTxAmount(e.link, (t ? t.amount : 0) + e.owed, { date: e.date, type: 'expense', method: cash ? 'cash' : 'account', account: cash ? '' : e.acct, category: e.cat || NONE, sub: '', note: e.note || 'Split bill', travel: 0, createdAt: new Date().toISOString() }); }
  }
  saveDebts(debtsList().filter(x => x.id !== id));
  ie = null; render(); toast('Deleted'); sync();
}

/* ---- the add form: split bill · friend paid · lend · borrow; and "mark as paid" ---- */
let df = null;
const DF_MODES = [['split', 'Split'], ['fsplit', 'Friend paid'], ['lend', 'Lend'], ['borrow', 'Borrow']];
const DF_HELP = { split: 'You paid the whole bill. Your friends owe you their share.', fsplit: 'A friend paid the bill. You owe them your share.',
  lend: 'You gave someone money.', borrow: 'Someone gave you money.' };
function dfDefaultAcct() { const n = accountNames(); return n.includes(ui.account) ? ui.account : (n[0] || CASH_KEY); }
function newDf(mode) {
  return { mode, person: '', extra: [], amount: '', parts: [], shares: {}, manual: false, me: true, cat: '', acct: dfDefaultAcct(), date: todayStr(), note: '', paidBack: false, items: [], net: 0 };
}
function openDebtForm(mode) { df = newDf(mode); formSession++; pushChrome(); }
function openPayForm(ids) {
  const items = debtsList().filter(e => ids.includes(e.id) && !e.paid);
  if (!items.length) return;
  df = newDf('pay'); df.items = items.map(e => e.id); df.person = items[0].person; df.net = r2(items.reduce((s, e) => s + e.owed, 0));
  formSession++; pushChrome();
}
const dfPerson = () => String(df.person || '').trim();
const dfPayer = () => df.mode === 'fsplit' ? dfPerson() : '';
// everyone except you who shares the bill (a friend-paid bill: the payer is always one of them)
function dfOthers() {
  const payer = dfPayer();
  const rest = df.parts.filter(n => pkey(n) !== pkey(payer));
  return payer ? [payer].concat(rest) : rest;
}
const dfSharers = () => dfOthers().length + ((df.mode === 'fsplit' || df.me) ? 1 : 0);
const dfShares = () => dfOthers().map(n => ({ name: n, v: parseAmount(df.shares[n] || '') }));
const dfMine = () => r2(parseAmount(df.amount) - dfShares().reduce((s, x) => s + x.v, 0));
function dfEqual() {
  const tot = parseAmount(df.amount), others = dfOthers(), n = dfSharers();
  if (!others.length || !(tot > 0) || !n) return;
  const each = Math.floor(tot / n * 100) / 100;   // the odd cents stay with you
  others.forEach(p => { df.shares[p] = String(each); });
}
function dfComplete() {
  if (!df) return false;
  if (df.mode === 'pay') return df.items.length > 0;
  const amt = parseAmount(df.amount); if (!(amt > 0)) return false;
  if (df.mode === 'split') { const sh = dfShares(); return sh.length > 0 && sh.every(x => x.v > 0) && dfMine() >= 0; }
  if (df.mode === 'fsplit') return !!dfPerson() && dfShares().every(x => x.v >= 0) && dfMine() > 0;
  return !!dfPerson();
}
function dfTitle() { return df.mode === 'pay' ? 'Mark as paid' : 'Add debt'; }
function dfSummary() {
  if (df.mode === 'pay') return df.items.length + (df.items.length === 1 ? ' item' : ' items') + ' · ' + baht(Math.abs(df.net));
  const amt = baht(parseAmount(df.amount));
  if (df.mode === 'split') return amt + ' split with ' + df.parts.concat(df.me ? ['you'] : []).join(', ');
  if (df.mode === 'fsplit') return amt + ' paid by ' + dfPerson() + ' · your share ' + baht(dfMine());
  if (df.mode === 'lend') return 'Lend ' + amt + ' to ' + dfPerson();
  return 'Borrow ' + amt + ' from ' + dfPerson();
}
function debtForm() {
  const m = df.mode, names = accountNames(), sharing = m === 'split' || m === 'fsplit';
  const accItems = names.map(n => ({ v: n, n })).concat([{ v: CASH_KEY, n: 'Cash' }]);
  if (df.acct && df.acct !== CASH_KEY && !names.includes(df.acct)) accItems.unshift({ v: df.acct, n: df.acct });
  const people = allPeople(df.extra);
  const secs = [];
  if (m === 'pay') {
    const n = df.items.length, tot = baht(Math.abs(df.net));
    secs.push({ header: { title: df.person }, rows: [{ type: 'note', text: (n === 1 ? '1 item' : n + ' items') + ' · ' + tot + (df.net > 0 ? ' · they pay you back' : df.net < 0 ? ' · you pay them back' : '') }] });
    if (df.net) secs.push({ header: { title: df.net > 0 ? 'Money in to' : 'Money out from' }, rows: [{ type: 'chips', id: 'dacc', sel: df.acct, items: chipItems(accItems) }] });
    secs.push({ rows: [{ type: 'date', id: 'ddate', title: 'Paid on', value: df.date }] });
    return { page: 'form-debt-' + formSession, colors: formColors('trv'), nonce: screenNonce, sections: secs };
  }
  secs.push({ header: { title: 'Type' }, footer: DF_HELP[m], rows: [{ type: 'seg', id: 'dmode', plain: true, sel: m, items: segItems(DF_MODES) }] });
  secs.push({ header: { title: sharing ? 'Total bill' : 'Amount' }, rows: [{ type: 'field', id: 'damt', big: true, kbd: 'decimal', value: df.amount, placeholder: '0.00' }] });
  if (m === 'fsplit' || m === 'lend' || m === 'borrow') {
    secs.push({ header: { title: m === 'fsplit' ? 'Who paid?' : 'Person' }, footer: people.length ? 'Manage your list in Settings › People.' : 'Add a name below, or keep a list in Settings › People.',
      rows: (people.length ? [{ type: 'chips', id: 'dperson', sel: df.person, items: chipItems(people.map(n => ({ v: n, n }))) }] : [])
        .concat([{ type: 'field', id: 'dnew', commit: true, title: 'Add', kbd: 'text', value: '', placeholder: 'New person, press Done' }]) });
  }
  if (sharing) {
    const payer = dfPayer(), isP = n => pkey(n) === pkey(payer);
    const list = people.filter(n => !isP(n));
    const items = (m === 'split' ? [{ v: ME, n: 'Me' }] : []).concat(list.map(n => ({ v: n, n })));
    const sels = (m === 'split' && df.me ? [ME] : []).concat(df.parts.filter(n => !isP(n)));
    secs.push({ header: { title: m === 'fsplit' ? 'Also shared with' : 'Split with' },
      footer: m === 'fsplit' ? 'Besides you and the person who paid. Leave empty if it was just the two of you.' : 'Switch “Me” off if you only paid for your friends and are not sharing the bill.',
      rows: [{ type: 'chips', id: 'dparts', sels, items: chipItems(items) },
        { type: 'field', id: 'addp', commit: true, title: 'Add', kbd: 'text', value: '', placeholder: 'New person, press Done' }] });
    const others = dfOthers();
    if (others.length) {
      const mine = dfMine();
      secs.push({ header: { title: m === 'fsplit' ? 'Each person’s share' : 'Each friend pays' },
        footer: mine < 0 ? 'The shares add up to more than the bill.' : (m === 'fsplit' || df.me || mine > 0) ? 'Your share: ' + baht(mine) : 'You are not sharing this bill.',
        rows: others.map(n => ({ type: 'field', id: 'ds:' + n, title: isP(n) ? n + ' (paid)' : n, kbd: 'decimal', value: df.shares[n] || '', placeholder: '0.00' }))
          .concat([{ type: 'button', id: 'deq', title: 'Split equally' }]) });
    }
    const cats = settings.expense.map(x => parseItem(x).name);
    secs.push({ header: { title: 'Category (optional)' }, rows: [{ type: 'chips', id: 'dcat', sel: df.cat, items: chipItems(cats.map(n => ({ v: n, n }))) }] });
  }
  if (m === 'fsplit') {
    secs.push({ header: { title: 'Paid back?' }, footer: df.paidBack ? 'Your share leaves the account you pick below. Nothing is left owing.' : 'Off: you still owe your share. It shows under “You owe”, and no account changes yet.',
      rows: [{ type: 'switch', id: 'dpaid', title: 'Already paid back', on: !!df.paidBack }] });
  }
  if (m !== 'fsplit' || df.paidBack) {
    const out = m === 'split' || m === 'lend' || m === 'fsplit';
    secs.push({ header: { title: m === 'split' ? 'Paid from (money out)' : m === 'fsplit' ? 'Paid back from (money out)' : out ? 'Money out from' : 'Money in to' },
      rows: [{ type: 'chips', id: 'dacc', sel: df.acct, items: chipItems(accItems) }] });
  }
  secs.push({ header: { title: 'Note' }, rows: [{ type: 'field', id: 'dnote', kbd: 'text', value: df.note, placeholder: sharing ? 'What was it? e.g. Karaoke' : 'Note (optional)' }] });
  secs.push({ rows: [{ type: 'date', id: 'ddate', title: 'Date', value: df.date }] });
  return { page: 'form-debt-' + formSession, colors: formColors('trv'), nonce: screenNonce, sections: secs };
}
function dfAction(kind, v) {
  const o = (v && typeof v === 'object') ? v : {};
  const sharing = () => df.mode === 'split' || df.mode === 'fsplit';
  const recalc = () => {
    df.parts = df.parts.filter(n => pkey(n) !== pkey(dfPayer()));
    if (sharing() && !df.manual) dfEqual();
  };
  const addPerson = raw => { const n = String(raw).trim(); if (!n) return ''; const c = canonName(n); if (!allPeople(df.extra).some(x => pkey(x) === pkey(c))) df.extra.push(c); return c; };
  if (kind === 'seg' && o.id === 'dmode') { df.mode = o.v; df.manual = false; recalc(); }
  else if (kind === 'chip') {
    if (o.id === 'dperson') { df.person = o.v; recalc(); }
    else if (o.id === 'dcat') df.cat = df.cat === o.v ? '' : o.v;
    else if (o.id === 'dacc') df.acct = o.v;
    else if (o.id === 'dparts') {
      if (o.v === ME) df.me = !df.me;
      else if (df.parts.some(p => pkey(p) === pkey(o.v))) { df.parts = df.parts.filter(p => pkey(p) !== pkey(o.v)); delete df.shares[o.v]; }
      else df.parts.push(o.v);
      recalc();
    }
  } else if (kind === 'field') {
    const id = String(o.id), val = String(o.v);
    if (id === 'damt') { df.amount = numOnly(val); recalc(); }
    else if (id === 'dnote') df.note = val;
    else if (id === 'ddate') df.date = val || todayStr();
    else if (id.startsWith('ds:')) { df.shares[id.slice(3)] = numOnly(val); df.manual = true; }
  } else if (kind === 'commit') {
    if (o.id === 'dnew') { const c = addPerson(o.v); if (c) { df.person = c; recalc(); } }
    else if (o.id === 'addp') { const c = addPerson(o.v); if (c && pkey(c) !== pkey(dfPayer()) && !df.parts.some(p => pkey(p) === pkey(c))) { df.parts.push(c); recalc(); } }
  } else if (kind === 'toggle' && o.id === 'dpaid') df.paidBack = !!o.on;
  else if (kind === 'button' && v === 'deq') { df.manual = false; dfEqual(); }
}
function saveDebtForm() {
  if (!dfComplete()) return;
  if (df.mode === 'pay') {
    const ids = new Set(df.items), acct = df.net ? df.acct : '';
    saveDebts(debtsList().map(e => ids.has(e.id) ? Object.assign({}, e, { paid: true, paidAcct: acct, paidDate: df.date || todayStr() }) : e));
    const n = df.items.length; df = null; render(); toast(n === 1 ? 'Marked paid' : n + ' items marked paid'); sync(); return;
  }
  const amt = parseAmount(df.amount), date = df.date || todayStr(), note = df.note.trim(), acct = df.acct, cash = acct === CASH_KEY, now = new Date().toISOString();
  const what = note || df.cat || '';
  const entry = (person, owed, kind, link, withNames) => ({ id: uid(), date, person: canonName(person), owed, acct, kind, note, what, with: withNames || [], cat: df.cat || '', link: link || '', createdAt: now });
  const mkTx = (share, text) => ({ id: uid(), date, type: 'expense', amount: share, method: cash ? 'cash' : 'account', account: cash ? '' : acct,
    category: df.cat || NONE, sub: '', note: text, travel: 0, createdAt: now });
  const entries = []; let t = null, msg = 'Saved';
  if (df.mode === 'split') {
    const sh = dfShares(), mine = dfMine();
    let link = 'g' + uid();
    if (mine > 0) { t = mkTx(mine, note || 'Split with ' + sh.map(x => x.name).join(', ')); link = t.id; }
    sh.forEach(x => entries.push(entry(x.name, x.v, 'split', link, sh.filter(y => y !== x).map(y => y.name))));
    msg = 'Split saved · ' + sh.length + (sh.length === 1 ? ' person owes' : ' people owe') + ' you';
  } else if (df.mode === 'fsplit') {
    const who = canonName(dfPerson()), mine = dfMine();
    const withNames = dfOthers().filter(n => pkey(n) !== pkey(who)).map(canonName);
    t = mkTx(mine, note || 'Paid by ' + who + (withNames.length ? ', split with ' + withNames.join(', ') : ''));
    if (df.paidBack) msg = 'Saved · your share ' + baht(mine) + ' paid';
    else { entries.push(entry(who, -mine, 'split', t.id, withNames)); msg = 'Saved · you owe ' + who + ' ' + baht(mine); }
  } else if (df.mode === 'lend') { entries.push(entry(dfPerson(), amt, 'lend')); msg = 'Lent ' + baht(amt) + ' to ' + canonName(dfPerson()); }
  else { entries.push(entry(dfPerson(), -amt, 'borrow')); msg = 'Borrowed ' + baht(amt) + ' from ' + canonName(dfPerson()); }
  if (t) { tx.push(t); queue.push({ op: 'add', tx: t }); saveTx(); }
  // anyone new joins the saved list (Settings › People)
  const used = entries.map(e => e.person).concat(df.mode === 'fsplit' ? [dfPerson()] : []);
  const saved = Array.isArray(settings.people) ? settings.people.slice() : [];
  used.forEach(n => { const c = canonName(n); if (c && !saved.some(x => pkey(x) === pkey(c))) saved.push(c); });
  settings = Object.assign({}, settings, { people: saved });
  saveDebts(debtsList().concat(entries));
  df = null; render(); toast(msg); sync();
}
async function debtSheetAction() {
  if (ie) {
    if (ieComplete()) {
      const r = await askAlert('Save changes?', '', [{ id: 'ok', title: 'Save', style: 'default' }, { id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
      if (r === 'ok') saveItemEdit(); else if (r === 'discard') { ie = null; pushChrome(); }
    } else { ie = null; pushChrome(); }
    return;
  }
  if (!df) return;
  if (dfComplete()) {
    const r = await askAlert(df.mode === 'pay' ? 'Mark as paid?' : 'Save this?', dfSummary(),
      [{ id: 'ok', title: 'Save', style: 'default' }, { id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
    if (r === 'ok') saveDebtForm(); else if (r === 'discard') { df = null; pushChrome(); }
  } else {
    const r = await askAlert('Discard this?', 'Nothing will be saved.', [{ id: 'discard', title: 'Discard', style: 'destructive' }, { id: 'keep', title: 'Keep editing', style: 'cancel' }]);
    if (r === 'discard') { df = null; pushChrome(); }
  }
}

function balanceSections() {
  const list = balances();
  const total = Math.round(list.reduce((s, r) => s + r.bal, 0) * 100) / 100;
  return [
    { rows: [{ type: 'hero', small: 'Total balance', big: baht(total), neg: total < 0, sub: list.length > 1 ? 'Across ' + list.length + ' places' : '' }] },
    { header: { title: 'Accounts & cash' }, footer: 'Balance = starting balance + income − expenses, adjusted for money you lend, borrow and get back. Set starting balances in Settings.',
      rows: list.map(r => ({ type: 'row', id: r.key, tap: true, title: r.name, sub: (r.editable || r.open) ? '' : 'Not in your account list',
        value: baht(r.bal), vk: r.bal < 0 ? 'neg' : '' })) }
  ];
}
function screenModel() {
  const colors = entryColors();
  if (ui.page === 'balance') return { page: 'balance', colors, sections: balanceSections() };
  if (ui.page === 'debts') return debtsModel(colors);
  if (ui.page === 'person') return personModel(colors);
  if (ui.page === 'subs') {
    const list = sortedSubs();
    const monthly = list.reduce((s, x) => s + (isCard(x) ? x.plan[0] : (x.cycle === 'year' ? x.amount / 12 : x.amount)), 0);
    const cards = list.filter(isCard), subs = list.length - cards.length;
    const left = cards.reduce((s, x) => s + x.plan.reduce((p, v) => p + v, 0), 0);
    const parts = [];
    if (subs) parts.push(subs + (subs === 1 ? ' subscription' : ' subscriptions'));
    if (cards.length) parts.push(cards.length + (cards.length === 1 ? ' card plan' : ' card plans') + ' · ' + baht(Math.round(left * 100) / 100) + ' left');
    return { page: 'subs', colors, sections: [
      { rows: [{ type: 'hero', small: 'Subscriptions cost', big: baht(Math.round(monthly * 100) / 100), unit: ' / month', sub: parts.join(' · ') }] },
      { header: { title: 'Upcoming', action: { id: 'add', title: '+ Add' } },
        rows: list.length ? list.map(x => {
          const d = daysUntil(x.next);
          const kind = isCard(x) ? 'Credit card · ' + x.plan.length + (x.plan.length === 1 ? ' payment left' : ' payments left') : (x.cycle === 'year' ? 'Yearly' : 'Monthly');
          return { type: 'row', id: x.id, tap: true, title: x.name,
            value: baht(curAmt(x)), caption: dueText(d, x.next), ck: d < 0 ? 'over' : (d <= Math.max(x.remind, 0) && x.remind >= 0 ? 'soon' : ''),
            button: { id: x.id, title: 'Paid' } };
        }) : [{ type: 'empty', text: 'Nothing here yet' }] }
    ] };
  }
  if (ui.page === 'recent') {
    const mp = maps();
    const q = ui.q.trim().toLowerCase();
    let sorted = sortTx(tx);
    if (q) sorted = sorted.filter(t => searchText(t, mp).includes(q));
    const shown = sorted.slice(0, ui.recentN);
    let secs = [];
    if (!shown.length) secs.push({ rows: [{ type: 'empty', text: q ? 'No matching entries' : 'No entries yet' }] });
    else {
      secs = daySections(shown, sorted);
      if (q) secs.forEach(sc => { sc.header.trailing = ''; });
      if (sorted.length > shown.length) secs.push({ rows: [{ type: 'button', id: 'more', title: 'Show more' }] });
    }
    return { page: 'recent', colors, search: ui.q, sections: secs };
  }
  if (ui.page === 'summary') {
    const m = ui.sumView === 'balance' ? { page: 'summary-balance', colors, nonce: screenNonce, sections: balanceSections() } : summaryModel(colors);
    m.sections.unshift({ rows: [{ type: 'seg', id: 'sumview', plain: true, sel: ui.sumView, items: segItems([['balance', 'Balance'], ['summary', 'Summary']]) }] });
    return m;
  }
  if (ui.page === 'settings') return settingsModel(colors);
  return null;
}

/* ---- form sheets (edit entry, subscription): the same row types, shown by a second native list above the page ---- */
let formSession = 0;
function formColors(accentKey) { const c = entryColors(); return Object.assign({}, c, { accent: c[accentKey] || c.trv }); }
function editComplete() { return !!ed && parseAmount(ed.amount) > 0; }
function formModel() {
  if (ie) return itemForm();
  if (df) return debtForm();
  if (!$('#subSheet').hidden && sb) return subForm();
  if (!$('#editSheet').hidden && ed) return editForm();
  return null;
}
const chipItems = list => list.map(i => ({ v: i.v, n: i.n }));
function editForm() {
  const mode = editMode();
  const names = accountNames();
  const secs = [{ header: { title: 'Amount' }, rows: [{ type: 'field', id: 'amount', big: true, kbd: 'decimal', value: ed.amount, placeholder: '0.00' }] }];
  if (mode === 'transfer') {
    const items = [{ v: CASH_KEY, n: 'Cash' }].concat(names.map(n => ({ v: n, n })));
    [ed.from, ed.to].forEach(v => { if (v && v !== CASH_KEY && !names.includes(v)) items.push({ v, n: v }); });
    secs.push({ header: { title: 'From' }, rows: [{ type: 'chips', id: 'efrom', sel: ed.from, items: chipItems(items) }] });
    secs.push({ header: { title: 'To' }, rows: [{ type: 'chips', id: 'eto', sel: ed.to, items: chipItems(items) }] });
  } else {
    const accItems = names.map(n => ({ v: n, n })).concat([{ v: CASH_KEY, n: 'Cash' }]);
    if (ed.acc && ed.acc !== CASH_KEY && !names.includes(ed.acc)) accItems.unshift({ v: ed.acc, n: ed.acc });
    const list = listFor(mode).map(x => parseItem(x).name);
    if (ed.category && !list.includes(ed.category)) list.push(ed.category);
    secs.push({ header: { title: mode === 'travel' ? 'Travel type' : 'Category' }, rows: [{ type: 'chips', id: 'ecat', sel: ed.category, items: chipItems(list.map(n => ({ v: n, n }))) }] });
    secs.push({ header: { title: 'Paid / received via' }, rows: [{ type: 'chips', id: 'eacc', sel: ed.acc, items: chipItems(accItems) }] });
  }
  secs.push({ header: { title: 'Note' }, rows: [{ type: 'field', id: 'note', kbd: 'text', value: ed.note, placeholder: 'Note (optional)' }] });
  secs.push({ rows: [{ type: 'date', id: 'date', title: 'Date', value: ed.date }] });
  return { page: 'form-edit-' + formSession, colors: formColors(mode), nonce: screenNonce, sections: secs };
}
let subFillVal = '';
function subForm() {
  const names = accountNames();
  const accItems = names.map(n => ({ v: n, n })).concat([{ v: CASH_KEY, n: 'Cash' }]);
  if (sb.acc && sb.acc !== CASH_KEY && !names.includes(sb.acc)) accItems.unshift({ v: sb.acc, n: sb.acc });
  const cats = settings.expense.map(x => parseItem(x).name);
  if (sb.cat && !cats.includes(sb.cat)) cats.push(sb.cat);
  const rem = [[-1, 'No reminder'], [0, 'On the day'], [1, '1 day before'], [3, '3 days before'], [7, '7 days before']];
  const card = sb.kind === 'card';
  const secs = [];
  secs.push({ header: { title: 'Type' }, rows: [{ type: 'seg', id: 'skind', sel: sb.kind, items: segItems([['sub', 'Subscription'], ['card', 'Credit card']]) }] });
  secs.push({ header: { title: 'Name' }, rows: [{ type: 'field', id: 'name', kbd: 'text', value: sb.name, placeholder: card ? 'e.g. iPhone installment' : 'e.g. Netflix' }] });
  if (card) {
    secs.push({ header: { title: 'Installments left' }, rows: [{ type: 'field', id: 'n', lazy: true, kbd: 'number', value: String(sb.plan.length), placeholder: 'e.g. 6' }] });
    secs.push({ header: { title: 'Amount of each installment' }, rows: [
      { type: 'field', id: 'fill', kbd: 'decimal', value: subFillVal, placeholder: 'Same amount for all' },
      { type: 'button', id: 'fillall', title: 'Fill all' }
    ].concat(sb.plan.map((v, i) => ({ type: 'field', id: 'plan:' + i, title: String(i + 1), kbd: 'decimal', value: String(v), placeholder: '0.00' }))) });
  } else {
    secs.push({ header: { title: 'Amount' }, rows: [{ type: 'field', id: 'amount', big: true, kbd: 'decimal', value: sb.amount, placeholder: '0.00' }] });
    secs.push({ header: { title: 'Billing cycle' }, rows: [{ type: 'seg', id: 'scycle', sel: sb.cycle, items: segItems([['month', 'Monthly'], ['year', 'Yearly']]) }] });
  }
  secs.push({ header: { title: card ? 'Next installment date' : 'Next payment date' }, rows: [{ type: 'date', id: 'date', title: 'Date', value: sb.next }] });
  secs.push({ header: { title: 'Always paid with' }, rows: [{ type: 'chips', id: 'sacc', sel: sb.acc, items: chipItems(accItems) }] });
  secs.push({ header: { title: 'Category (optional)' }, rows: [{ type: 'chips', id: 'scat', sel: sb.cat, items: chipItems(cats.map(n => ({ v: n, n }))) }] });
  secs.push({ header: { title: 'Remind me' }, rows: [{ type: 'chips', id: 'srem', sel: String(sb.remind), items: chipItems(rem.map(([v, n]) => ({ v: String(v), n }))) }] });
  if (sb.id) secs.push({ rows: [{ type: 'button', id: 'cal', title: 'Add to Calendar (iPhone reminder)' }, { type: 'button', id: 'del', title: 'Delete', style: 'danger' }] });
  return { page: 'form-sub-' + formSession, colors: formColors('trv'), nonce: screenNonce, sections: secs };
}

function formAction(kind, v) {
  if (ie) { ieAction(kind, v); pushChrome(); return; }
  if (df) { dfAction(kind, v); pushChrome(); return; }
  const o = (v && typeof v === 'object') ? v : {};
  if (sb && !$('#subSheet').hidden) {
    if (kind === 'seg') { if (o.id === 'skind') sb.kind = o.v; else if (o.id === 'scycle') sb.cycle = o.v; renderSubEditor(); }
    else if (kind === 'chip') {
      if (o.id === 'sacc') sb.acc = o.v;
      else if (o.id === 'scat') sb.cat = sb.cat === o.v ? '' : o.v;
      else if (o.id === 'srem') sb.remind = Number(o.v);
      renderSubEditor();
    } else if (kind === 'field') {
      if (o.id === 'name') sb.name = String(o.v);
      else if (o.id === 'amount') sb.amount = numOnly(o.v);
      else if (o.id === 'date') sb.next = String(o.v);
      else if (o.id === 'fill') subFillVal = numOnly(o.v);
      else if (o.id === 'n') { if (applyPlanN(o.v)) renderSubEditor(); }
      else if (String(o.id).startsWith('plan:')) sb.plan[Number(String(o.id).slice(5))] = numOnly(o.v);
      updateSubAction();
    } else if (kind === 'button') {
      if (v === 'fillall') { if (subFillVal) { sb.plan = sb.plan.map(() => subFillVal); renderSubEditor(); } }
      else if (v === 'cal') downloadIcs();
      else if (v === 'del') deleteSub();
    }
  } else if (ed && !$('#editSheet').hidden) {
    if (kind === 'chip') {
      if (o.id === 'ecat') ed.category = ed.category === o.v ? '' : o.v;
      else if (o.id === 'eacc') ed.acc = o.v;
      else if (o.id === 'efrom') ed.from = o.v;
      else if (o.id === 'eto') ed.to = o.v;
      renderEdit();
    } else if (kind === 'field') {
      if (o.id === 'amount') ed.amount = numOnly(o.v);
      else if (o.id === 'note') ed.note = String(o.v);
      else if (o.id === 'date') ed.date = String(o.v);
    }
  }
  pushChrome();
}

function setDomInput(selector, attr, key, value) {
  $$(selector).forEach(i => { if (i.dataset[attr] === key) i.value = value; });
}
function addDraftItem(key, raw) {
  const v = String(raw).trim();
  if (!v || !draft[key]) return;
  if (!draft[key].some(x => parseItem(x).name.toLowerCase() === parseItem(v).name.toLowerCase())) draft[key].push(v);
  else toast('Already in the list');
  renderEditor(key);
}

function screenAction(kind, v) {
  if (ie || df || (sb && !$('#subSheet').hidden) || (ed && !$('#editSheet').hidden)) { formAction(kind, v); return; }
  const o = (v && typeof v === 'object') ? v : {};
  if (kind === 'row') {
    if (ui.page === 'subs') showSubDetail(v);
    else if (ui.page === 'recent') openEdit(v);
    else if (ui.page === 'summary') { if (ui.sumView === 'balance') showBalanceDetail(v); else if (v === 'detail') $('#detailToggle').click(); else openEdit(v); }
    else if (ui.page === 'debts') { if (String(v).startsWith('p:')) openPersonPage(String(v).slice(2)); else if (String(v).startsWith('i:')) showItemDetail(String(v).slice(2)); }
    else if (ui.page === 'person') showItemDetail(String(v));
    else if (ui.page === 'balance') showBalanceDetail(v);
    else if (ui.page === 'settings' && String(v).startsWith('sub:')) { ui.settingsSub = String(v).slice(4); if (!SET_SUBS[ui.settingsSub]) ui.settingsSub = ''; }
  }
  else if (kind === 'button') {
    if (ui.page === 'subs') payNow(v);
    else if (ui.page === 'recent') { if (v === 'more') { ui.recentN += 50; renderRecent(); } }
    else if (ui.page === 'person') { if (v === 'paidall') { const p = peopleStat().find(x => x.key === ui.person); if (p) openPayForm(p.entries.filter(e => !e.paid && isItem(e)).map(e => e.id)); } }
    else if (ui.page === 'settings') {
      const fm = String(v).match(/^fav:(\w+):(\d+)$/);
      if (fm) toggleFav(fm[1], Number(fm[2]));
      else if (v === 'reset') resetSub();
      else if (v === 'test') testConn();
      else if (v === 'signin') acctSubmit();
      else if (v === 'forgot') acctForgot();
      else if (v === 'google') acctGoogle();
      else if (v === 'signout') acctSignOut();
      else if (v === 'syncnow') sync(true);
      else if (v === 'ex-tx') exportEntries();
      else if (v === 'ex-debts') exportDebts();
      else if (v === 'ex-json') exportBackup();
      else if (v === 'restore') pickBackup();
    }
  }
  else if (kind === 'delete') {
    if (ui.page === 'settings') {
      const m = String(v).match(/^li:(\w+):(\d+)$/);
      if (m && draft[m[1]]) { draft[m[1]].splice(Number(m[2]), 1); renderEditor(m[1]); }
    } else removeTx(v);
  }
  else if (kind === 'action') {
    if (ui.page === 'subs' && v === 'add') openSub('');
    else if (ui.page === 'summary' && v === 'bud') $('#budEdit').click();
    else if (ui.page === 'debts' && v === 'add') openDebtForm('split');
  }
  else if (kind === 'search') { ui.q = String(v); ui.recentN = 50; renderRecent(); }
  else if (kind === 'seg') {
    if (o.id === 'amode') { acct.mode = o.v === 'up' ? 'up' : 'in'; acct.msg = ''; }
    else if (o.id === 'dview') { ui.debtView = o.v === 'item' ? 'item' : 'person'; render(); }
    else if (o.id === 'sumview') { ui.sumView = o.v === 'balance' ? 'balance' : 'summary'; ui.budEdit = false; render(); }
    else if (o.id === 'range') { ui.range = o.v; ui.budEdit = false; renderSummary(); }
    else if (o.id === 'lang') { cfg.lang = o.v; saveCfg(); document.documentElement.lang = curLang(); screenNonce++; markSettingsSegs(); render(); }
    else if (o.id === 'theme') { cfg.theme = o.v; saveCfg(); applyTheme(); markSettingsSegs(); }
    else if (o.id === 'week') { cfg.weekStart = Number(o.v); saveCfg(); markSettingsSegs(); }
  }
  else if (kind === 'nav') {
    if (v === 'prev') shiftAnchor(-1); else if (v === 'next') shiftAnchor(1); else ui.anchor = new Date();
    renderSummary();
  }
  else if (kind === 'field') {
    const id = String(o.id), val = String(o.v);
    if (id.startsWith('bud:')) { ui.budDraft = ui.budDraft || {}; ui.budDraft[id.slice(4)] = numOnly(val); }
    else if (id.startsWith('open:')) { const k = id.slice(5); openDraft[k] = numOnly(val); setDomInput('#openList input[data-open]', 'open', k, openDraft[k]); }
    else if (id === 'em') acct.email = val;
    else if (id === 'pw') acct.pass = val;
    else if (id === 'url') $('#cfgUrl').value = val;
    else if (id === 'key') $('#cfgKey').value = val;
  }
  else if (kind === 'move') {
    const l = draft[o.key], f = Number(o.from), t = Number(o.to);
    if (l && f >= 0 && f < l.length && t >= 0 && t < l.length) { const [x] = l.splice(f, 1); l.splice(t, 0, x); renderEditor(o.key); }
  }
  else if (kind === 'commit') {
    if (String(o.id).startsWith('add:')) addDraftItem(String(o.id).slice(4), o.v);
  }
  else if (kind === 'toggle') {
    if (o.id === 'face') setFace(!!o.on).then(refreshScreen);
    else if (o.id === 'notify') setNotify(!!o.on).then(refreshScreen);
  }
  pushChrome();
}

const alertWaiters = {};
let alertSeq = 0;
// A centered iOS alert inside the iPhone app; a plain confirm() on the web.
function askAlert(title, message, buttons) {
  return new Promise(resolve => {
    const hnd = NATIVE && chromeH();
    if (hnd) {
      const token = 'a' + (++alertSeq);
      alertWaiters[token] = resolve;
      hnd.postMessage({ alert: trDeep({ token, title, message: message || '', buttons }) });
      return;
    }
    const cancel = buttons.find(b => b.style === 'cancel') || buttons[buttons.length - 1];
    const primary = buttons.find(b => b.style !== 'cancel' && b.style !== 'destructive') || buttons.find(b => b.style !== 'cancel') || buttons[0];
    resolve(confirm(T(title) + (message ? '\n' + T(message) : '')) ? primary.id : cancel.id);
  });
}
window.__chrome = {
  entry: entryAction,
  screen: screenAction,
  alertResult(token, id) { const r = alertWaiters[token]; delete alertWaiters[token]; if (r) r(id); },
  act(name) {
    if (name === 'recent') ui.page === 'recent' ? goBack() : showPage('recent');
    else if (name === 'back') goBack();
    else if (name === 'settings') $('#settingsBtn').click();
    else if (name === 'sheet') sheetAction();
    else if (name === 'sync') $('#syncBtn').click();
    else if (name === 'unlock') unlock();
    else if (TITLES[name] && name !== 'recent') showPage(name);
  },
  imported(name, text) { importData(name, text); },
  googleResult(token, err) { googleResult(token, err); },
  auth(kind, v) {
    const o = (v && typeof v === 'object') ? v : {};
    if (kind === 'step') { acct.step = ['welcome', 'in', 'up'].includes(v) ? v : 'welcome'; acct.msg = ''; acct.bad = false; pushChrome(); }
    else if (kind === 'submit') { acct.email = String(o.email || ''); acct.pass = String(o.pass || ''); acct.mode = acct.step === 'up' ? 'up' : 'in'; acctSubmit(); }
    else if (kind === 'google') acctGoogle();
    else if (kind === 'forgot') { acct.email = String(o.email || acct.email); acctForgot(); }
  },
  ready() { pushChrome(); }
};

/* ================= navigation / render ================= */
const TITLES = { entry: 'Lemoney', subs: 'Subs', recent: 'Recent', summary: 'Summary', balance: 'Balance', debts: 'Debts', person: 'Person', settings: 'Settings' };
const SUBPAGE = { recent: 1, settings: 1, person: 1 };   // full pages without the tab bar, with a back chevron
function showPage(name) {
  const prevPage = ui.page;
  if (SUBPAGE[name] && !SUBPAGE[ui.page]) ui.backTo = ui.page || 'entry';
  ui.page = name;
  document.body.classList.toggle('on-recent', name === 'recent');
  document.body.classList.toggle('on-settings', name === 'settings');
  document.body.dataset.page = name;
  $('#backBtn').hidden = !SUBPAGE[name];
  gatePage(name);
  Object.keys(TITLES).forEach(p => { $('#page-' + p).hidden = p !== name; });
  $('#pageTitle').textContent = TITLES[name];
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.page === name));
  $('#recentBtn').classList.toggle('active', name === 'recent');
  if (name !== 'balance') ui.balEdit = false;
  if (name !== 'summary') ui.budEdit = false;
  if (prevPage !== name) {
    const dir = SUBPAGE[name] && !SUBPAGE[prevPage] ? 'in-fwd' : (!SUBPAGE[name] && SUBPAGE[prevPage] ? 'in-back' : 'in-fade');
    const el = $('#page-' + name);
    el.classList.remove('in-fwd', 'in-back', 'in-fade');
    void el.offsetWidth;
    el.classList.add(dir);
    setTimeout(() => el.classList.remove(dir), 450);
  }
  window.scrollTo(0, 0);
  { const hd = document.querySelector('.top'); if (hd) { hd.style.opacity = ''; hd.style.filter = ''; } }
  render();
}
function render() {
  if (ui.page === 'entry') renderEntry();
  else if (ui.page === 'recent') renderRecent();
  else if (ui.page === 'subs') renderSubs();
  else if (ui.page === 'balance') renderBalance();
  else if (ui.page === 'debts') renderDebtsWeb();
  else if (ui.page === 'person') { if (!peopleStat().some(x => x.key === ui.person)) { showPage('debts'); return; } }
  else if (ui.page === 'settings') { /* static form, filled by openSettings */ }
  else renderSummary();
  renderDue();
  if (!hasBackend()) setSync('unset');
  pushChrome();
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

$('#settingsBtn').addEventListener('click', () => openSettings());
$('#setupBtn').addEventListener('click', () => openSettings(true));
$('#testBtn').addEventListener('click', testConn);
$('#resetLists').addEventListener('click', () => { fillLists(DEFAULTS); toast('Defaults loaded — go back to save'); });
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
const goBack = () => {
  if (ui.page === 'settings' && !ui.leaving) {
    if (ui.settingsSub) { ui.settingsSub = ''; render(); return; }   // back from a Settings sub-page
    saveSettingsForm(); return;   // going back from Settings = save
  }
  showPage(ui.backTo && !SUBPAGE[ui.backTo] ? ui.backTo : 'entry');
};
$('#recentBtn').addEventListener('click', () => ui.page === 'recent' ? goBack() : showPage('recent'));
$('#backBtn').addEventListener('click', goBack);
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
  if (e.target.id === 'sbFillBtn') {
    const v = $('#sbFill').value.replace(/[^\d.,]/g, '');
    if (v) { sb.plan = sb.plan.map(() => v); renderSubEditor(); }
    return;
  }
  if (set('skind', 'kind') || set('scycle', 'cycle') || set('sacc', 'acc') || set('srem', 'remind', Number)) renderSubEditor();
});
$('#subBody').addEventListener('input', e => {
  if (!sb) return;
  if (e.target.id === 'sbName') sb.name = e.target.value;
  else if (e.target.id === 'sbAmt') { const v = e.target.value.replace(/[^\d.,]/g, ''); if (v !== e.target.value) e.target.value = v; sb.amount = v; }
  else if (e.target.id === 'sbDate') sb.next = e.target.value;
  else if (e.target.dataset.plan !== undefined) { const v = e.target.value.replace(/[^\d.,]/g, ''); if (v !== e.target.value) e.target.value = v; sb.plan[Number(e.target.dataset.plan)] = v; }
  updateSubAction();
});
function applyPlanN(nArg) {
  const el = $('#sbN');
  if (!sb || (nArg === undefined && !el)) return false;
  const n = Math.max(1, Math.min(60, parseInt(nArg !== undefined ? nArg : el.value, 10) || 1));
  if (n === sb.plan.length) return false;
  const keep = sb.plan.slice(0, n);
  const fill = keep.length ? keep[keep.length - 1] : '';
  while (keep.length < n) keep.push(fill);
  sb.plan = keep;
  return true;
}
$('#subBody').addEventListener('change', e => { if (sb && e.target.id === 'sbN' && applyPlanN()) renderSubEditor(); });
$('#closeSub').addEventListener('click', subAction);
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
  if (ui.budEdit) { commitBudget(); ui.budEdit = false; ui.budDraft = {}; toast('Budget saved'); }
  else { ui.budEdit = true; ui.budDraft = {}; }
  renderSummary();
});
$('#recentMore').addEventListener('click', () => { ui.recentN += 50; renderRecent(); });
$('#themeSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-theme]'); if (!b) return;
  cfg.theme = b.dataset.theme; saveCfg(); applyTheme(); markSettingsSegs(); pushChrome();
});
$('#weekSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-ws]'); if (!b) return;
  cfg.weekStart = Number(b.dataset.ws); saveCfg(); markSettingsSegs();
});
$('#syncBtn').addEventListener('click', () => hasBackend() ? sync(true) : (NATIVE ? (ui.settingsSub = 'account', showPage('settings')) : openSettings(true)));

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
initNative();
syncSegs();
requestAnimationFrame(() => requestAnimationFrame(() => $$('.seg, .tabs').forEach(el => el.classList.add('ready'))));
sizeAmount();
setSync(hasBackend() ? (queue.length ? 'warn' : 'ok') : 'unset', hasBackend() && queue.length ? pendingText() : undefined);
fbInit();
sync();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();

/* ---------- Add page stays put (no scrolling); balance/summary header fades as you scroll (web version) ---------- */
document.addEventListener('touchmove', e => {
  if (ui.page === 'entry' && !e.target.closest('.sheet, input, textarea')) e.preventDefault();
}, { passive: false });
window.addEventListener('scroll', () => {
  const hd = document.querySelector('.top');
  if (NATIVE || !hd) return;
  if (ui.page === 'balance' || ui.page === 'summary' || ui.page === 'subs' || ui.page === 'debts') {
    const y = Math.max(0, window.scrollY);
    hd.style.opacity = String(Math.max(0, 1 - y / 70));
    hd.style.filter = y > 1 ? 'blur(' + Math.min(10, y / 8).toFixed(1) + 'px)' : '';
  } else { hd.style.opacity = ''; hd.style.filter = ''; }
}, { passive: true });
