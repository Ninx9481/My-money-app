/* Lemoney web app renderer.
 * app.js builds one "model" per screen (the same ones the iPhone app draws natively) and hands it to chromeH().postMessage().
 * Here those models are drawn as HTML. Actions go back through window.__chrome (the same entry points the iPhone app uses).
 * Inactive inside the iPhone app (Capacitor). */
(function () {
  'use strict';
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return;

  const $c = () => window.__chrome;
  const tr = s => (typeof window.T === 'function' ? window.T(s) : s);
  const isTh = () => typeof window.curLang === 'function' && window.curLang() === 'th';
  // words only the iPhone app's Swift code had (not part of the JS string table)
  const LOC = {
    'Email address': 'อีเมล', "Don't have an account?": 'ยังไม่มีบัญชี?', 'Register now': 'สมัครเลย', 'Already have an account?': 'มีบัญชีแล้ว?',
    'Welcome\nto Lemoney': 'ยินดีต้อนรับ\nสู่ Lemoney', 'At least 6 characters': 'อย่างน้อย 6 ตัวอักษร', "Passwords don't match": 'รหัสผ่านไม่ตรงกัน',
    'Note (optional)': 'โน้ต (ไม่บังคับ)', 'Not connected to Google Sheet yet — tap to set up': 'ยังไม่ได้เชื่อมต่อ — แตะเพื่อตั้งค่า',
    'Delete': 'ลบ', 'Back': 'กลับ', 'Close': 'ปิด', 'Save': 'บันทึก', 'Search note, category, amount': 'ค้นหาโน้ต หมวดหมู่ จำนวนเงิน',
    'Add': 'เพิ่ม', 'Subs': 'ประจำ', 'Debts': 'หนี้', 'Summary': 'สรุป', 'Expense': 'รายจ่าย', 'Income': 'รายรับ', 'Travel': 'เดินทาง',
    'Transfer': 'โอนเงิน', 'Account': 'บัญชี', 'Cash': 'เงินสด', 'Amount': 'จำนวนเงิน', 'From': 'จาก', 'To': 'ถึง', 'Swap': 'สลับ', 'Today': 'วันนี้',
    'Unlock': 'ปลดล็อก', 'OK': 'ตกลง', 'Cancel': 'ยกเลิก', 'Sync data': 'ซิงก์ข้อมูล', 'Recent entries': 'รายการล่าสุด', 'Settings': 'ตั้งค่า',
    'Or sign in with': 'หรือเข้าสู่ระบบด้วย', 'Or sign up with': 'หรือสมัครด้วย', 'Continue with Google': 'ดำเนินการต่อด้วย Google',
    'Sign in': 'เข้าสู่ระบบ', 'Create account': 'สร้างบัญชี', 'Forgot password?': 'ลืมรหัสผ่าน?', 'Password': 'รหัสผ่าน', 'Confirm password': 'ยืนยันรหัสผ่าน',
    'Welcome back': 'ยินดีต้อนรับกลับมา', 'Create your account': 'สร้างบัญชีของคุณ', 'Sign in to sync your expenses and accounts.': 'เข้าสู่ระบบเพื่อซิงก์รายการและบัญชีของคุณ'
  };
  const L = s => (isTh() ? (LOC[s] || tr(s)) : s);

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    };
    for (let i = 2; i < arguments.length; i++) add(arguments[i]);
    return el;
  }
  const ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>', up: '<path d="M5 15l7-7 7 7"/>', down: '<path d="M5 9l7 7 7-7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', repeat: '<path d="M4 11V9a3 3 0 013-3h11l-3-3M20 13v2a3 3 0 01-3 3H6l3 3"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.5 6-5.5s6 2.1 6 5.5M16 5.2a3.2 3.2 0 010 5.6M18 14.8c1.9.7 3 2.4 3 5.2"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>', swap: '<path d="M8 4v16M8 4L4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5"/>',
    eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 6.2A9.5 9.5 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9M6.4 7.6A16.5 16.5 0 002 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8"/>',
    grip: '<path d="M8 9h8M8 15h8"/>'
  };
  const svg = (name, fill, size) => h('span', { class: 'wi', html: '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + '</svg>' });

  /* ---------- shell ---------- */
  document.body.classList.add('webui');
  const root = h('div', { id: 'webui' });
  const topBar = h('header', { class: 'w-top' });
  const main = h('main', { class: 'w-main' });
  const tabBar = h('nav', { class: 'w-tabs' });
  const toastEl = h('div', { class: 'w-toast' });
  const authEl = h('div', { class: 'w-auth', hidden: true });
  const sheetEl = h('div', { class: 'w-sheet-wrap', hidden: true });
  const alertEl = h('div', { class: 'w-alert-wrap', hidden: true });
  root.append(topBar, main, tabBar, sheetEl, authEl, alertEl, toastEl);
  document.body.appendChild(root);
  const send = (fn, kind, v) => { const c = $c(); if (c && c[fn]) c[fn](kind, v); };
  const act = name => { const c = $c(); if (c) c.act(name); };

  const brand = h('div', { class: 'w-brand' }, h('span', { class: 'lg', text: 'L' }), h('div', null, h('b', { text: 'Lemoney' }), h('small', { text: 'Personal Wealth' })));
  tabBar.appendChild(brand);
  const TABS = [['entry', 'plus', 'Add'], ['subs', 'repeat', 'Subs'], ['debts', 'people', 'Debts'], ['summary', 'chart', 'Summary']];
  const tabBtns = {};
  TABS.forEach(([page, icon, label]) => {
    const b = h('button', { class: 'w-tab', onclick: () => act(page), 'aria-label': label });
    b.append(svg(icon, false, 24), h('span', { class: 'tl' }), h('i', { class: 'wdot', hidden: true }));
    tabBtns[page] = b; tabBar.appendChild(b);
  });
  const sideSet = h('button', { class: 'w-side-set', onclick: () => act('settings') }, svg('gear', false, 20), h('span', { class: 'sl' }));
  tabBar.append(h('span', { class: 'w-grow' }), sideSet);

  let last = {}, lastPage = '', queued = null;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ---------- messages from app.js ---------- */
  function post(m) {
    if (m.toast !== undefined) return showToast(m.toast);
    if (m.alert) return showAlert(m.alert);
    if (m.share) return doShare(m.share);
    if (m.pick) return doPick();
    if (m.google) return doGoogle(m.google);
    queued = m;
    if (!post.raf) post.raf = requestAnimationFrame(() => { post.raf = 0; const x = queued; queued = null; if (x) apply(x); });
  }

  function accentOf(m) {
    const c = (m.entry && m.entry.accent) || (m.form && m.form.colors && m.form.colors.accent) || (m.screen && m.screen.colors && m.screen.colors.accent);
    return c || '';
  }

  function apply(m) {
    document.documentElement.lang = m.lang || 'en';
    const authOn = !!m.auth;
    authEl.hidden = !authOn;
    root.classList.toggle('gated', authOn);
    if (authOn) renderAuth(m.auth); else authReset();

    // top bar
    const sheetOn = !!(m.form && m.sheet);
    const barKey = JSON.stringify([m.title, m.back, m.page, m.sync, m.syncText, tabsShown(m)]);
    if (barKey !== last.bar) { last.bar = barKey; renderTop(m); }
    // tab bar
    tabBar.classList.toggle('off', !m.tabs);
    TABS.forEach(([page, , label]) => {
      const b = tabBtns[page];
      b.classList.toggle('on', m.page === page || (page === 'summary' && m.page === 'balance'));
      b.querySelector('.tl').textContent = L(label);
      b.querySelector('.wdot').hidden = !(page === 'subs' && m.due);
    });

    sideSet.querySelector('.sl').textContent = L('Settings');
    // body
    const pageChanged = m.page !== lastPage;
    if (m.entry) {
      const k = JSON.stringify(m.entry);
      if (k !== last.entry || pageChanged || last.kind !== 'entry') { last.entry = k; last.kind = 'entry'; renderEntry(m.entry); }
    } else if (m.screen) {
      const k = JSON.stringify(m.screen);
      if (k !== last.screen || last.kind !== 'screen') {
        last.screen = k; last.kind = 'screen';
        keepFocus(main, () => renderListInto(main, m.screen, { page: m.page, reset: pageChanged || last.kindPrev !== 'screen' }));
      }
    } else if (last.kind) { last.kind = ''; main.textContent = ''; }
    last.kindPrev = last.kind;
    if (pageChanged) { main.scrollTop = 0; lastPage = m.page; }

    // form sheet
    if (sheetOn) {
      const k = JSON.stringify([m.form, m.sheet]);
      if (k !== last.form) { last.form = k; renderSheet(m); }
      sheetEl.hidden = false;
    } else if (!sheetEl.hidden) { sheetEl.hidden = true; last.form = ''; sheetEl.textContent = ''; }
    const acc = accentOf(m);
    if (acc) root.style.setProperty('--accent', acc);
    document.body.classList.toggle('w-modal', sheetOn || authOn);
  }
  const tabsShown = m => !!m.tabs;

  /* keep the focused input (and caret) when a screen redraws while someone is typing */
  function keepFocus(container, fn) {
    const a = document.activeElement;
    let rid = null, s0 = 0, s1 = 0;
    if (a && container.contains(a) && a.dataset && a.dataset.rid) { rid = a.dataset.rid; try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) {} }
    const st = container.scrollTop;
    fn();
    container.scrollTop = st;
    if (rid) {
      const n = container.querySelector('[data-rid="' + (window.CSS && CSS.escape ? CSS.escape(rid) : rid) + '"]');
      if (n) { n.focus(); try { n.setSelectionRange(s0, s1); } catch (e) {} }
    }
  }

  /* ---------- top bar ---------- */
  function renderTop(m) {
    topBar.textContent = '';
    const sub = !!m.back;
    const left = h('div', { class: 'l' });
    if (sub) left.appendChild(h('button', { class: 'w-ib', 'aria-label': L('Back'), onclick: () => act('back') }, svg('back')));
    left.appendChild(h('h1', { class: sub ? 'sub' : '', text: m.title || 'Lemoney' }));
    const right = h('div', { class: 'r' });
    const st = m.sync || '';
    const pill = h('button', { class: 'w-sync ' + st, 'aria-label': L('Sync data'), onclick: () => act('sync') }, h('i'), h('span', { text: m.syncText || '—' }));
    right.appendChild(pill);
    if (!sub) {
      right.appendChild(h('button', { class: 'w-ib', 'aria-label': L('Recent entries'), onclick: () => act('recent') }, svg('clock')));
      right.appendChild(h('button', { class: 'w-ib', 'aria-label': L('Settings'), onclick: () => act('settings') }, svg('gear')));
    }
    topBar.append(left, right);
  }

  /* ---------- toast / alert ---------- */
  let toastT;
  function showToast(t) {
    toastEl.textContent = t; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2000);
  }
  function showAlert(a) {
    alertEl.textContent = '';
    const btns = (a.buttons || []).slice();
    const box = h('div', { class: 'w-alert', role: 'alertdialog' }, h('h3', { text: a.title || '' }), a.message ? h('p', { text: a.message }) : null);
    const row = h('div', { class: 'w-alert-btns' + (btns.length > 2 ? ' wcol' : '') });
    btns.forEach(b => row.appendChild(h('button', {
      class: b.style === 'destructive' ? 'bad' : b.style === 'cancel' ? 'cancel' : 'main',
      text: b.title || L('OK'),
      onclick: () => { alertEl.hidden = true; send('alertResult', a.token, b.id); }
    })));
    box.appendChild(row);
    alertEl.appendChild(box); alertEl.hidden = false;
    const first = row.querySelector('.main') || row.lastChild; if (first) first.focus();
  }
  /* ---------- file export / import ---------- */
  function doShare(s) {
    const a = h('a', { href: URL.createObjectURL(new Blob([s.text || ''], { type: 'text/plain;charset=utf-8' })), download: s.name || 'lemoney.txt' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function doPick() {
    const inp = h('input', { type: 'file', accept: '.json,.csv,application/json,text/csv,text/plain', style: 'position:fixed;left:-999px' });
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; inp.remove();
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { const c = $c(); if (c && c.imported) c.imported(f.name, String(r.result || '')); };
      r.readAsText(f);
    });
    document.body.appendChild(inp); inp.click();
  }
  async function doGoogle(g) {
    const c = $c(); const fb = g && g.fb;
    try {
      if (!fb || !fb.signInGooglePopup) throw new Error('unavailable');
      await fb.signInGooglePopup();
      c.googleResult('__done__', '');
    } catch (e) {
      const code = String((e && e.code) || (e && e.message) || e);
      c.googleResult(null, /popup-closed|cancelled-popup|cancel/.test(code) ? 'cancel' : code.replace('auth/', ''));
    }
  }

  /* ---------- Add page ---------- */
  const entryEl = { amount: null };
  let entryClear = 0, entryFocus = 0;
  function seg(items, sel, onpick, cls) {
    const el = h('div', { class: 'w-seg ' + (cls || '') });
    items.forEach(it => {
      el.appendChild(h('button', { class: it.v === sel ? 'on' : '', text: it.n, onclick: () => onpick(it.v) }));
    });
    return el;
  }
  function chipFlow(items, sel, onpick, sels) {
    const el = h('div', { class: 'w-chips' });
    items.forEach(it => {
      const more = it.v === '__more__' || it.v === '__less__';
      const on = !more && (sels ? sels.indexOf(it.v) >= 0 : it.v === sel);
      const b = h('button', { class: 'w-chip' + (on ? ' on' : '') + (more ? ' more' : ''), onclick: () => onpick(it.v) });
      if (more) b.appendChild(svg(it.v === '__more__' ? 'down' : 'up', false, 16)); else b.textContent = it.n;
      el.appendChild(b);
    });
    return el;
  }
  function renderEntry(e) {
    const prevAmount = entryEl.amount ? entryEl.amount.value : '', prevNote = entryEl.note ? entryEl.note.value : '';
    const hadFocus = document.activeElement && main.contains(document.activeElement) ? document.activeElement.dataset.rid : '';
    const st = main.scrollTop;
    main.textContent = '';
    const acc = e.accent || 'var(--trv)';
    const wrap = h('div', { class: 'w-entry', style: '--accent:' + acc });
    if (e.setup || e.due) {
      wrap.appendChild(h('button', { class: 'w-banner', onclick: () => send('entry', e.setup ? 'setup' : 'due', 0), text: e.setup ? L('Not connected to Google Sheet yet — tap to set up') : e.due }));
    }
    const card = h('div', { class: 'w-card wentry' });
    const modes = [['expense', 'Expense'], ['income', 'Income'], ['travel', 'Travel'], ['transfer', 'Transfer']];
    card.appendChild(seg(modes.map(([v, n]) => ({ v, n: L(n) })), e.mode, v => send('entry', 'mode', v), 'accent'));
    // amount
    const amt = h('input', { class: 'w-amount', type: 'text', inputmode: 'decimal', placeholder: '0.00', autocomplete: 'off', 'data-rid': 'amount', 'aria-label': L('Amount') });
    amt.value = prevAmount;
    const size = () => { amt.style.width = Math.max(4, (amt.value || amt.placeholder).length + 0.6) + 'ch'; };
    amt.addEventListener('input', () => { amt.value = amt.value.replace(/[^\d.,]/g, ''); size(); send('entry', 'amount', amt.value); });
    size();
    card.appendChild(h('div', { class: 'w-amount-row' }, h('span', { class: 'wbaht', text: '฿' }), amt));
    entryEl.amount = amt;
    if (e.mode === 'transfer') {
      const ends = e.ends || [];
      card.appendChild(h('div', { class: 'w-label', text: L('From') }));
      card.appendChild(chipFlow(ends, e.from, v => send('entry', 'from', v)));
      card.appendChild(h('button', { class: 'w-swap', onclick: () => send('entry', 'swap', 0) }, svg('swap', false, 16), h('span', { text: L('Swap') })));
      card.appendChild(h('div', { class: 'w-label', text: L('To') }));
      card.appendChild(chipFlow(ends, e.to, v => send('entry', 'to', v)));
    } else {
      card.appendChild(h('div', { class: 'w-label', text: L(e.mode === 'income' ? 'Received in' : 'Paid / received via') }));
      card.appendChild(seg([{ v: 'account', n: L('Account') }, { v: 'cash', n: L('Cash') }], e.method, v => send('entry', 'method', v)));
      if ((e.accounts || []).length) card.appendChild(chipFlow(e.accounts.map(n => ({ v: n, n })), e.account, v => send('entry', 'account', v)));
      card.appendChild(h('div', { class: 'w-label', text: e.catLabel }));
      card.appendChild(chipFlow((e.cats || []).map(n => ({ v: n, n })), e.category, v => send('entry', 'category', v)));
    }
    const note = h('input', { class: 'w-note', type: 'text', placeholder: L('Note (optional)'), enterkeyhint: 'done', 'data-rid': 'note', autocomplete: 'off' });
    note.value = prevNote;
    note.addEventListener('input', () => send('entry', 'note', note.value));
    entryEl.note = note;
    const date = h('input', { class: 'w-date', type: 'date', 'data-rid': 'date', value: e.date });
    date.addEventListener('change', () => send('entry', 'date', date.value));
    card.appendChild(h('div', { class: 'w-note-row' }, note, date));
    const save = h('button', { class: 'w-save', text: e.saveTitle || L('Save'), onclick: () => send('entry', 'save', 0) });
    card.appendChild(save);
    wrap.appendChild(card);
    main.appendChild(wrap);
    main.scrollTop = st;
    if (e.clear !== entryClear) { entryClear = e.clear; amt.value = ''; note.value = ''; size(); }
    if (e.focus !== entryFocus) { entryFocus = e.focus; amt.focus(); }
    else if (hadFocus) { const n = main.querySelector('[data-rid="' + hadFocus + '"]'); if (n) { n.focus(); } }
  }

  /* ---------- list screens ---------- */
  const fmtVk = vk => ({ neg: 'exp', expense: 'exp', income: 'inc', transfer: 'trf', muted: 'muted' }[vk] || '');
  function renderListInto(container, model, opts) {
    const st = container.scrollTop;
    container.textContent = '';
    const edit = !!model.edit;
    const list = h('div', { class: 'w-list' });
    if (model.search !== undefined) {
      const s = h('input', { class: 'w-search', type: 'search', placeholder: L('Search note, category, amount'), 'data-rid': '__search', autocomplete: 'off' });
      s.value = model.search || '';
      s.addEventListener('input', () => send('screen', 'search', s.value));
      list.appendChild(s);
    }
    (model.sections || []).forEach((sec, si) => {
      const wrap = h('section', { class: 'w-sec' });
      if (sec.header) {
        const hd = h('div', { class: 'w-sec-h' }, h('span', { text: sec.header.title || '' }));
        if (sec.header.action) hd.appendChild(h('button', { class: 'act', text: sec.header.action.title, onclick: () => send('screen', 'action', sec.header.action.id) }));
        else if (sec.header.trailing) hd.appendChild(h('span', { class: 'tr', text: sec.header.trailing }));
        wrap.appendChild(hd);
      }
      const rows = sec.rows || [];
      const bare = rows.length > 0 && rows.every(r => r.type === 'nav' || (r.type === 'seg' && r.plain) || (r.type === 'button' && r.glass));
      const card = h('div', { class: 'w-group' + (bare ? ' bare' : '') });
      let lastMove = -1; rows.forEach((r, i) => { if (r.move != null) lastMove = i; });
      rows.forEach((r, i) => { const el = renderRow(r, { edit, i, lastMove, rows, model }); if (el) card.appendChild(el); });
      wrap.appendChild(card);
      if (sec.footer) wrap.appendChild(h('div', { class: 'w-sec-f', text: sec.footer }));
      list.appendChild(wrap);
    });
    container.appendChild(list);
    container.scrollTop = opts && opts.reset ? 0 : st;
  }

  function renderRow(r, ctx) {
    const t = r.type || 'row';
    const id = r.id || '';
    switch (t) {
      case 'hero': return h('div', { class: 'w-hero' },
        h('div', { class: 'small', text: r.small || '' }),
        h('div', { class: 'wbig' + (r.neg ? ' neg' : '') }, r.big || '', r.unit ? h('small', { text: r.unit }) : null),
        r.sub ? h('div', { class: 'sub', text: r.sub }) : null);
      case 'empty': return h('div', { class: 'w-empty', text: r.text || '' });
      case 'note': return h('div', { class: 'w-note-t ' + (r.nk || ''), text: r.text || '' });
      case 'button': return h('div', { class: 'w-btnrow' + (r.glass ? ' glass' : '') },
        h('button', { class: 'w-btn' + (r.glass ? ' g' : '') + (r.style === 'danger' ? ' danger' : ''), text: r.title || '', onclick: () => send('screen', 'button', id) }));
      case 'seg': {
        const el = seg((r.items || []).map(i => ({ v: i.v, n: i.n })), r.sel, v => send('screen', 'seg', { id, v }), r.plain ? 'plain' : '');
        return h('div', { class: 'w-segrow' + (r.plain ? ' plain' : '') }, el);
      }
      case 'nav': return h('div', { class: 'w-nav' },
        h('button', { class: 'w-round', 'aria-label': 'prev', onclick: () => send('screen', 'nav', 'prev') }, svg('back', false, 20)),
        h('div', { class: 'ttl', text: r.title || '', onclick: () => send('screen', 'nav', 'today') }),
        r.today ? h('button', { class: 'w-today', text: L('Today'), onclick: () => send('screen', 'nav', 'today') }) : null,
        h('button', { class: 'w-round', disabled: r.next === false, 'aria-label': 'next', onclick: () => send('screen', 'nav', 'next') }, svg('right', false, 20)));
      case 'totals': return h('div', { class: 'w-totals' }, (r.items || []).map(it =>
        h('div', { class: 'wcol' }, h('div', { class: 'l', text: it.l || '' }), h('div', { class: 'v ' + (it.k || ''), text: it.v || '' }))));
      case 'bar': {
        const k = r.k || '';
        return h('div', { class: 'w-bar' },
          h('div', { class: 'wtop' }, h('span', { class: 'n', text: r.title || '' }), h('span', { class: 'v', text: r.value || '' })),
          h('div', { class: 'wtrack' }, h('i', { class: 'k-' + k, style: 'width:' + Math.round(Math.min(1, Math.max(0, r.w || 0)) * 1000) / 10 + '%' })),
          r.note ? h('div', { class: 'note k-' + k, text: r.note }) : null);
      }
      case 'stack': return renderStack(r);
      case 'chart': return renderChart(r);
      case 'field': return renderField(r);
      case 'switch': {
        const cb = h('input', { type: 'checkbox', class: 'w-switch', 'data-rid': id });
        cb.checked = !!r.on;
        cb.addEventListener('change', () => send('screen', 'toggle', { id, on: cb.checked }));
        return h('label', { class: 'w-row' }, h('div', { class: 'wmid' }, h('div', { class: 'ti', text: r.title || '' })), cb);
      }
      case 'date': {
        const inp = h('input', { type: 'date', class: 'w-date inline', 'data-rid': id });
        inp.value = r.value || '';
        inp.addEventListener('change', () => send('screen', 'field', { id, v: inp.value }));
        return h('label', { class: 'w-row' }, h('div', { class: 'wmid' }, h('div', { class: 'ti', text: r.title || '' })), inp);
      }
      case 'chips': return h('div', { class: 'w-chiprow' }, chipFlow((r.items || []).map(i => ({ v: i.v, n: i.n })), r.sel, v => send('screen', 'chip', { id, v }), r.sels));
      default: return renderMoneyRow(r, ctx);
    }
  }

  function renderMoneyRow(r, ctx) {
    const id = r.id || '';
    const row = h('div', { class: 'w-row' + (r.tap ? ' tap' : '') });
    const inner = [];
    if (ctx.edit && r.del) inner.push(h('button', { class: 'w-minus', 'aria-label': L('Delete'), onclick: ev => { ev.stopPropagation(); send('screen', 'delete', r.del); } }, svg('x', false, 14)));
    if (r.icon) inner.push(h('span', { class: 'ic', text: r.icon }));
    inner.push(h('div', { class: 'wmid' }, h('div', { class: 'ti' + (r.light ? ' light' : ''), text: r.title || '' }), r.sub ? h('div', { class: 'su', text: r.sub }) : null));
    if (r.value != null || r.caption) {
      inner.push(h('div', { class: 'rt' }, r.value != null ? h('div', { class: 'va ' + fmtVk(r.vk), text: r.value }) : null,
        r.caption ? h('div', { class: 'ca ' + (r.ck || ''), text: r.caption }) : null));
    }
    if (r.button) {
      const b = r.button;
      if (b.symbol) inner.push(h('button', { class: 'w-star' + (b.on ? ' on' : ''), 'aria-label': 'favorite', onclick: ev => { ev.stopPropagation(); send('screen', 'button', b.id); } }, svg(b.symbol === 'star.fill' || b.on ? 'star' : 'star', !!b.on, 20)));
      else inner.push(h('button', { class: 'w-pill', text: b.title || '', onclick: ev => { ev.stopPropagation(); send('screen', 'button', b.id); } }));
    }
    if (ctx.edit && r.move != null) {
      const i = ctx.i;
      inner.push(h('span', { class: 'w-move' },
        h('button', { disabled: i === 0, onclick: ev => { ev.stopPropagation(); send('screen', 'move', { key: r.move, from: i, to: i - 1 }); } }, svg('up', false, 16)),
        h('button', { disabled: i >= ctx.lastMove, onclick: ev => { ev.stopPropagation(); send('screen', 'move', { key: r.move, from: i, to: i + 1 }); } }, svg('down', false, 16))));
    }
    if (r.chevron) inner.push(h('span', { class: 'wchev' }, svg(r.chevron === 'up' ? 'up' : r.chevron === 'right' ? 'right' : 'down', false, 16)));
    inner.forEach(x => row.appendChild(x));
    if (r.tap) row.addEventListener('click', () => send('screen', 'row', id));
    if (!ctx.edit && r.del) return swipeRow(row, r.del);
    return row;
  }

  /* swipe a row left to reveal Delete (touch or mouse drag) */
  function swipeRow(row, delId) {
    const wrap = h('div', { class: 'w-swipe' });
    const del = h('button', { class: 'w-del', text: L('Delete'), onclick: () => send('screen', 'delete', delId) });
    wrap.append(del, row);
    let x0 = 0, dx = 0, drag = false, open = false, moved = false;
    const W = 88;
    const set = (v, anim) => { row.style.transition = anim ? 'transform .2s' : 'none'; row.style.transform = 'translateX(' + v + 'px)'; };
    row.addEventListener('pointerdown', e => { if (e.button > 0) return; drag = true; moved = false; x0 = e.clientX - (open ? -W : 0); dx = open ? -W : 0; });
    row.addEventListener('pointermove', e => {
      if (!drag) return;
      dx = Math.max(-W - 20, Math.min(0, e.clientX - x0));
      if (Math.abs(dx) > 6) { moved = true; try { row.setPointerCapture(e.pointerId); } catch (_) {} }
      if (moved) set(dx, false);
    });
    const end = () => { if (!drag) return; drag = false; open = dx < -W / 2; set(open ? -W : 0, true); };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    row.addEventListener('click', e => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } else if (open) { e.stopImmediatePropagation(); open = false; set(0, true); } }, true);
    return wrap;
  }

  function renderField(r) {
    const id = r.id || '';
    const kb = r.kbd || 'text';
    const inp = h('input', {
      class: 'w-field' + (r.big ? ' wbig' : ''), 'data-rid': id, placeholder: r.placeholder || '', autocomplete: 'off', autocapitalize: kb === 'text' ? 'sentences' : 'none',
      type: kb === 'secure' ? 'password' : kb === 'url' ? 'url' : kb === 'email' ? 'email' : 'text',
      inputmode: kb === 'decimal' ? 'decimal' : kb === 'number' ? 'numeric' : null
    });
    inp.value = r.value || '';
    inp.addEventListener('input', () => {
      if (kb === 'decimal') inp.value = inp.value.replace(/[^\d.,]/g, '');
      if (kb === 'number') inp.value = inp.value.replace(/[^\d]/g, '');
      if (!r.lazy && !r.commit) send('screen', 'field', { id, v: inp.value });
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('blur', () => {
      if (r.commit) { const v = inp.value; if (v) { inp.value = ''; send('screen', 'commit', { id, v }); } }
      else if (r.lazy) send('screen', 'field', { id, v: inp.value });
    });
    const title = r.title && !r.big ? h('span', { class: 'ti' + (r.stack ? ' stack' : ''), text: r.title }) : null;
    return h('label', { class: 'w-row field' + (r.stack ? ' stacked' : '') + (r.big ? ' bigrow' : '') }, title, inp);
  }

  function renderStack(r) {
    const parts = r.parts || [];
    const total = parts.reduce((a, p) => a + (p.f || 0), 0) || 1;
    const colorOf = p => (p.c >= 0 && p.c < 6) ? 'var(--s' + (p.c + 1) + ')' : 'var(--s-other, var(--muted))';
    const bar = h('div', { class: 'w-stackbar' });
    parts.forEach(p => bar.appendChild(h('i', { style: 'flex:' + ((p.f || 0) / total) + ';background:' + colorOf(p) })));
    const leg = h('div', { class: 'w-legend' });
    parts.forEach(p => leg.appendChild(h('div', { class: 'wlg' }, h('i', { style: 'background:' + colorOf(p) }), h('span', { class: 'n', text: p.n || '' }), h('span', { class: 'wpc', text: (p.pct || 0) + '%' }), h('span', { class: 'v', text: p.v || '' }))));
    return h('div', { class: 'w-stack' }, bar, leg);
  }

  let chartSel = -1;
  function renderChart(r) {
    const b = r.buckets || [];
    let max = 1; b.forEach(x => { max = Math.max(max, x.e || 0, x.i || 0); });
    const tip = h('div', { class: 'wtip', text: chartSel >= 0 && b[chartSel] ? b[chartSel].tip : L('Tap a bar for details') });
    const plot = h('div', { class: 'w-plot' });
    b.forEach((x, k) => {
      const col = h('button', { class: 'bk' + (x.cur ? ' cur' : '') + (k === chartSel ? ' sel' : ''), onclick: () => { chartSel = chartSel === k ? -1 : k; tip.textContent = chartSel >= 0 ? b[k].tip : L('Tap a bar for details'); plot.querySelectorAll('.bk').forEach((el, j) => el.classList.toggle('sel', j === chartSel)); } },
        h('div', { class: 'wbars' }, h('i', { class: 'we', style: 'height:' + ((x.e || 0) / max * 100) + '%' }), h('i', { class: 'wii', style: 'height:' + ((x.i || 0) / max * 100) + '%' })),
        h('span', { class: 'wlb', text: x.l || '' }));
      plot.appendChild(col);
    });
    const leg = h('div', { class: 'w-cleg' }, h('span', {}, h('i', { class: 'we' }), L('Expenses')), h('span', {}, h('i', { class: 'wii' }), L('Income')));
    return h('div', { class: 'w-chart' + (b.length > 14 ? ' dense' : '') }, plot, tip, leg);
  }

  /* ---------- form sheet ---------- */
  function renderSheet(m) {
    keepFocus(sheetEl, () => {
      const prev = sheetEl.querySelector('.w-sheet-body'); const st = prev ? prev.scrollTop : 0;
      sheetEl.textContent = '';
      const confirm = m.sheet.action === 'confirm';
      const body = h('div', { class: 'w-sheet-body' });
      renderListInto(body, m.form, { reset: false });
      const panel = h('div', { class: 'w-sheet', role: 'dialog' },
        h('div', { class: 'w-sheet-top' }, h('h2', { text: m.sheet.title || '' }),
          h('button', { class: 'w-ib' + (confirm ? ' ok' : ''), 'aria-label': confirm ? L('Save') : L('Close'), onclick: () => act('sheet') }, svg(confirm ? 'check' : 'x'))),
        body);
      sheetEl.appendChild(h('div', { class: 'w-backdrop' }));
      sheetEl.appendChild(panel);
      body.scrollTop = st;
    });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheetEl.hidden && alertEl.hidden) act('sheet'); });

  /* ---------- sign in / create account ---------- */
  let authStep = '', authForm = null, showPass = false;
  function authReset() { authStep = ''; authForm = null; authEl.textContent = ''; }
  function renderAuth(a) {
    const step = a.step || 'welcome';
    if (step !== authStep || !authForm) { authStep = step; build(step); }
    // update dynamic bits without rebuilding (keeps typing/focus)
    if (authForm.msg) { authForm.msg.textContent = a.msg ? L(a.msg) : ''; authForm.msg.className = 'w-auth-msg' + (a.bad ? ' bad' : ''); }
    if (authForm.email && a.email && !authForm.email.value) authForm.email.value = a.email;
    authEl.classList.toggle('busy', !!a.busy);
    if (authForm.primary) authForm.primary.disabled = !!a.busy;
    if (authForm.google) authForm.google.disabled = !!a.busy;

    function build(s) {
      authEl.textContent = '';
      authForm = {};
      const box = h('div', { class: 'w-auth-box' });
      if (s === 'welcome') {
        box.classList.add('welcome');
        const t = L('Welcome\nto Lemoney');
        box.appendChild(h('div', { class: 'wc' }, h('h1', { text: t }), h('p', { text: 'Simple, native, mindful expense tracking designed to keep you in control.' })));
        box.appendChild(h('div', { class: 'wb' },
          h('button', { class: 'w-big primary', text: L('Create account'), onclick: () => send('auth', 'step', 'up') }),
          h('button', { class: 'w-big soft', text: L('Sign in'), onclick: () => send('auth', 'step', 'in') }),
          h('div', { class: 'ver', text: 'Version 1.0 • Local-first & Private' })));
      } else {
        const isIn = s === 'in';
        box.appendChild(h('button', { class: 'w-ib back', 'aria-label': L('Back'), onclick: () => send('auth', 'step', 'welcome') }, svg('back')));
        box.appendChild(h('h1', { class: 'ft', text: L(isIn ? 'Welcome back' : 'Create your account') }));
        box.appendChild(h('p', { class: 'fs', text: isIn ? L('Sign in to sync your expenses and accounts.') : 'Start mindful expense tracking today.' }));
        const lab = t => h('label', { class: 'fl', text: isIn ? L(t).toUpperCase() : L(t) });
        const email = h('input', { class: 'w-in', type: 'email', placeholder: 'name@example.com', autocomplete: 'email', autocapitalize: 'none', inputmode: 'email' });
        const pass = h('input', { class: 'w-in', type: 'password', placeholder: '••••••••', autocomplete: isIn ? 'current-password' : 'new-password' });
        const eye = h('button', { class: 'w-eye', type: 'button', 'aria-label': 'show password', onclick: () => { showPass = !showPass; pass.type = showPass ? 'text' : 'password'; eye.replaceChildren(svg(showPass ? 'eyeoff' : 'eye', false, 20)); } }, svg(showPass ? 'eyeoff' : 'eye', false, 20));
        pass.type = showPass ? 'text' : 'password';
        const conf = h('input', { class: 'w-in', type: 'password', placeholder: '••••••••', autocomplete: 'new-password' });
        box.appendChild(lab('Email address')); box.appendChild(h('div', { class: 'w-inwrap' }, email));
        box.appendChild(lab('Password')); box.appendChild(h('div', { class: 'w-inwrap' }, pass, eye));
        if (!isIn) { box.appendChild(lab('Confirm password')); box.appendChild(h('div', { class: 'w-inwrap' }, conf)); box.appendChild(h('div', { class: 'whint', text: 'ⓘ ' + L('At least 6 characters') })); }
        else box.appendChild(h('button', { class: 'w-link forgot', text: L('Forgot password?'), onclick: () => send('auth', 'forgot', { email: email.value }) }));
        const msg = h('div', { class: 'w-auth-msg' });
        box.appendChild(msg);
        const submit = () => {
          if (!isIn && pass.value !== conf.value) { msg.textContent = L("Passwords don't match"); msg.className = 'w-auth-msg bad'; return; }
          send('auth', 'submit', { email: email.value, pass: pass.value });
        };
        const primary = h('button', { class: 'w-big primary', text: L(isIn ? 'Sign in' : 'Create account'), onclick: submit });
        [email, pass, conf].forEach(i => i.addEventListener('keydown', ev => { if (ev.key === 'Enter') submit(); }));
        box.appendChild(primary);
        box.appendChild(h('div', { class: 'or', text: L(isIn ? 'Or sign in with' : 'Or sign up with') }));
        const google = h('button', { class: 'w-big gbtn', onclick: () => send('auth', 'google', '') },
          h('span', { class: 'g', html: '<svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 019.5 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>' }),
          h('span', { text: L('Continue with Google') }));
        box.appendChild(google);
        box.appendChild(h('button', { class: 'w-link wsw', onclick: () => send('auth', 'step', isIn ? 'up' : 'in') },
          isIn ? L("Don't have an account?") + ' ' : L('Already have an account?') + ' ', h('b', { text: isIn ? L('Register now') : L('Sign in') })));
        Object.assign(authForm, { email, pass, conf, msg, primary, google });
      }
      authEl.appendChild(box);
      authEl.scrollTop = 0;
    }
  }

  window.WEBUI = { post, version: 1 };
  window.__chrome_ready = () => { const c = $c(); if (c && c.ready) c.ready(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(window.__chrome_ready, 0)); else setTimeout(window.__chrome_ready, 0);
})();
