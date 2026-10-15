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
  anchor: new Date()
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
const COLORS = { light: '#f6f3ea', dark: '#0e0f13' };
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
  if (t.travel) return { icon: ic(mp.travel, t.sub) || '🚌', title: tn(t.sub) || TRAVEL };
  if (t.type === 'income') return { icon: ic(mp.income, t.category) || '💰', title: tn(t.category) || 'Income' };
  return { icon: ic(mp.expense, t.category) || (tn(t.category) === TRAVEL ? '🚌' : '🏷️'), title: tn(t.category) || NONE };
}

function itemHTML(t, mp, showDate) {
  const info = itemInfo(t, mp);
  const way = t.method === 'cash' ? '💵 Cash' : acctIcon(mp, t.account) + ' ' + (tn(t.account) || 'Account');
  const sub = [showDate ? dateLabel(t.date) : '', way, t.note].filter(Boolean).map(esc).join(' · ');
  const sign = t.type === 'income' ? '+' : '−';
  return `<div class="item">
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
  a.style.width = ((a.value ? Math.max(1, a.value.length) : 4) + 0.7) + 'ch';   // empty → fits the "0.00" placeholder; +0.7 = slack so iOS never clips the last digit
}

function renderEntry() {
  $('#entryCard').className = 'card entry mode-' + ui.mode;
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === ui.mode));
  $$('#methodSeg button').forEach(b => b.classList.toggle('on', b.dataset.method === ui.method));

  const names = accountNames();
  if (!names.includes(ui.account)) ui.account = names[0] || '';
  const accRow = $('#accountRow');
  if (ui.method === 'account' && settings.accounts.length > 1) {
    accRow.innerHTML = settings.accounts.map((a, i) => {
      const p = parseItem(a);
      return `<button type="button" class="chip${p.name === ui.account ? ' on' : ''}" data-acc="${i}">${esc((p.icon ? p.icon + ' ' : '') + p.name)}</button>`;
    }).join('');
  } else accRow.innerHTML = '';

  $('#catLabel').textContent = ui.mode === 'travel' ? 'Travel type' : 'Category';
  $('#catChips').innerHTML = listFor(ui.mode).map((c, i) => {
    const p = parseItem(c);
    return `<button type="button" class="chip${p.name === ui.category ? ' on' : ''}" data-cat="${i}">${esc((p.icon ? p.icon + ' ' : '') + p.name)}</button>`;
  }).join('');

  $('#saveBtn').textContent = ui.mode === 'income' ? 'Save income' : ui.mode === 'travel' ? 'Save travel' : 'Save expense';
  $('#date').value = ui.date;
  $('#setupBanner').hidden = !!cfg.url;

  const mp = maps();
  const recent = tx.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);
  $('#todayTitle').textContent = 'Recent entries';
  const t = todayStr();
  const todayExp = tx.filter(x => x.date === t && x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  $('#todaySum').textContent = todayExp ? 'Spent today ' + baht(todayExp) : '';
  $('#todayList').innerHTML = recent.length ? recent.map(x => itemHTML(x, mp, true)).join('') : '<div class="empty">No entries yet</div>';
}

function parseAmount(s) {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function addEntry() {
  const amt = parseAmount($('#amount').value);
  if (!(amt > 0)) { toast('Enter an amount first'); $('#amount').focus(); return; }
  const travel = ui.mode === 'travel';
  const t = {
    id: uid(),
    date: ui.date || todayStr(),
    type: ui.mode === 'income' ? 'income' : 'expense',
    amount: amt,
    method: ui.method,
    account: ui.method === 'account' ? ui.account : '',
    category: travel ? TRAVEL : (ui.category || NONE),
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
  toast('✓ Saved ' + baht(amt));
  sync();
}

function removeTx(id) {
  const t = tx.find(x => x.id === id);
  if (!t) return;
  const label = t.travel ? (tn(t.sub) || TRAVEL) : tn(t.category);
  if (!confirm(`Delete this entry?\n${t.type === 'income' ? '+' : '−'}${money(t.amount)} · ${label}`)) return;
  tx = tx.filter(x => x.id !== id);
  const i = queue.findIndex(o => o.op === 'add' && o.tx.id === id);
  if (i >= 0 && queue[i] !== inflight) queue.splice(i, 1);
  else queue.push({ op: 'delete', id });
  saveTx(); saveQueue();
  render();
  toast('Deleted');
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
  if (range === 'day') return (p.s === todayStr() ? 'Today · ' : '') + F_FULL.format(parseYmd(p.s));
  if (range === 'week') {
    const a = parseYmd(p.s), b = parseYmd(p.e);
    const left = a.getMonth() === b.getMonth() ? String(a.getDate()) : F_DM.format(a);
    return `${left} – ${F_DM.format(b)} ${F_Y.format(b)}`;
  }
  return String(p.y);
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
  if (!rows.length) return '<div class="empty">No data</div>';
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

  /* chart (week / year) */
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
      $('#chartTitle').textContent = 'Daily this week';
    } else {
      buckets = Array.from({ length: 12 }, (_, m) => {
        const pre = `${p.y}-${pad(m + 1)}`;
        const now = new Date();
        return { label: F_M.format(new Date(p.y, m, 1)), cur: now.getFullYear() === p.y && now.getMonth() === m,
          e: sum(exp.filter(x => x.date.startsWith(pre))), i: sum(inc.filter(x => x.date.startsWith(pre))) };
      });
      $('#chartTitle').textContent = 'Monthly this year';
    }
    const max = Math.max(1, ...buckets.map(b => Math.max(b.e, b.i)));
    $('#chart').innerHTML = buckets.map(b => `<div class="col${b.cur ? ' cur' : ''}">
      <div class="bars"><div class="bar e" style="height:${b.e / max * 100}%"></div><div class="bar i" style="height:${b.i / max * 100}%"></div></div>
      <div class="lb">${esc(b.label)}</div></div>`).join('');
  }

  /* by payment method / category / travel */
  const has = exp.length > 0;
  $('#splitCard').hidden = !has;
  $('#catCard').hidden = !has;
  const travel = exp.filter(t => t.travel);
  $('#travelCard').hidden = !travel.length;
  if (has) {
    const split = groupSum(exp, t => t.method === 'cash' ? 'Cash' : (tn(t.account) || 'Account'))
      .map(([k, v]) => [k, v, k === 'Cash' ? '💵' : acctIcon(mp, k)]);
    $('#splitList').innerHTML = brkHTML(split, expSum, 'acc');
    const cats = groupSum(exp, t => t.travel ? TRAVEL : (tn(t.category) || NONE))
      .map(([k, v]) => [k, v, k === TRAVEL ? '🚌' : (ic(mp.expense, k) || '🏷️')]);
    $('#catList').innerHTML = brkHTML(cats, expSum);
  }
  if (travel.length) {
    const ts = sum(travel);
    $('#travelTotal').textContent = baht(ts);
    const subs = groupSum(travel, t => tn(t.sub) || 'Other').map(([k, v]) => [k, v, ic(mp.travel, k) || '🚌']);
    $('#travelList').innerHTML = brkHTML(subs, ts, 'trv');
  }

  /* entries / monthly table */
  const dc = $('#detailList');
  if (ui.range === 'year') {
    $('#detailTitle').textContent = 'Monthly summary';
    dc.classList.remove('list');
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
    dc.classList.add('list');
    if (!inRange.length) dc.innerHTML = '<div class="empty">No entries yet</div>';
    else {
      const sorted = sortTx(inRange);
      let html = '', cur = '';
      sorted.forEach(t => {
        if (ui.range === 'week' && t.date !== cur) {
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
    tx = server.filter(t => !pendDel.has(t.id)).concat(queue.filter(o => o.op === 'add' && !ids.has(o.tx.id)).map(o => o.tx));
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

/* ================= settings sheet ================= */
function fillLists(src) {
  $('#setAccounts').value = src.accounts.join('\n');
  $('#setExpense').value = src.expense.join('\n');
  $('#setIncome').value = src.income.join('\n');
  $('#setTravel').value = src.travel.join('\n');
}
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
const lines = id => $(id).value.split('\n').map(s => s.trim()).filter(Boolean);

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
  toast('Settings saved');
  sync();
}

/* ================= navigation / render ================= */
function showPage(name) {
  ui.page = name;
  $('#page-entry').hidden = name !== 'entry';
  $('#page-summary').hidden = name !== 'summary';
  $('#pageTitle').textContent = name === 'entry' ? 'Money' : 'Summary';
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
$('#resetLists').addEventListener('click', () => { fillLists(DEFAULTS); toast('Defaults loaded — tap Save settings'); });
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

/* ================= boot ================= */
applyTheme();
render();
sizeAmount();
setSync(cfg.url ? (queue.length ? 'warn' : 'ok') : 'unset', cfg.url && queue.length ? pendingText() : undefined);
sync();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
