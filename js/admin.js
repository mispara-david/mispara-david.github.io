/* דוד הספר – לוגיקת דף הניהול */
(function () {
  'use strict';

  const el = id => document.getElementById(id);
  let adminDate = null;

  function fmtDate(dateStr) { const [y,m,d]=dateStr.split('-'); return `${d}/${m}`; }
  function showMsg(box, text, type) { box.textContent = text; box.className = 'msg show ' + type; }

  /* ---------- כניסה ---------- */
  const PW_KEY = 'davidAdminPw';   // התחברות נשמרת (לאפליקציה של דוד)

  async function login() {
    const pw = el('pw').value;
    if (await Store.checkPassword(pw)) {
      try { localStorage.setItem(PW_KEY, pw); } catch (e) {}
      openPanel();
    } else {
      showMsg(el('loginMsg'), 'סיסמה שגויה', 'err');
    }
  }
  el('loginBtn').addEventListener('click', login);
  el('pw').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

  function openPanel() {
    el('loginCard').classList.add('hidden');
    el('panel').classList.remove('hidden');
    initTabs();
    loadAdminDays();
    loadBlocks();
    loadSettings();
    // תאריך ברירת מחדל בסגירות = היום
    el('closeDate').value = Store.ymd(new Date());
  }

  /* ---------- טאבים ---------- */
  function initTabs() {
    document.querySelectorAll('.tab-links button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-links button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
        el('tab-' + btn.dataset.tab).classList.remove('hidden');
      });
    });
  }

  /* ---------- תורים ---------- */
  async function loadAdminDays() {
    const s = await Store.getSettings();
    const box = el('adminDays');
    box.innerHTML = '';
    const today = new Date();
    let first = null;
    for (let i = 0; i < (s.bookAheadDays || 21); i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      const dateStr = Store.ymd(d);
      if (!s.workDays.includes(d.getDay())) continue;
      const bookings = await Store.getBookings(dateStr);
      const div = document.createElement('div');
      div.className = 'day';
      div.innerHTML = `<div class="dname">${Store.DAY_NAMES[d.getDay()]}</div>
                       <div class="ddate">${fmtDate(dateStr)}</div>
                       <div class="dfree">${bookings.length} תורים</div>`;
      div.addEventListener('click', () => selectAdminDay(dateStr, div));
      box.appendChild(div);
      if (!first) first = { dateStr, div };
    }
    if (first) selectAdminDay(first.dateStr, first.div);
  }

  async function selectAdminDay(dateStr, div) {
    document.querySelectorAll('#adminDays .day').forEach(x => x.classList.remove('active'));
    div.classList.add('active');
    adminDate = dateStr;
    renderBookings(dateStr);
  }

  async function renderBookings(dateStr) {
    const box = el('adminBookings');
    const bookings = await Store.getBookings(dateStr);
    if (!bookings.length) {
      box.innerHTML = '<div class="empty-note">אין תורים ליום הזה.</div>';
      return;
    }
    box.innerHTML = '';
    bookings.forEach(b => {
      const row = document.createElement('div');
      row.className = 'booking-row';
      const srcLabel = b.source === 'phone' ? 'טלפון' : 'אתר';
      row.innerHTML = `
        <div class="time">${b.time}</div>
        <div class="info">
          <div class="nm">${escapeHtml(b.name)}</div>
          <div class="ph">${escapeHtml(b.phone)}</div>
        </div>
        <span class="src ${b.source === 'phone' ? 'phone' : ''}">${srcLabel}</span>
        <button class="btn danger small">בטל</button>`;
      row.querySelector('button').addEventListener('click', async () => {
        if (confirm(`לבטל את התור של ${b.name} בשעה ${b.time}?`)) {
          await Store.cancelBooking(b.id);
          renderBookings(dateStr);
          loadAdminDays();
        }
      });
      box.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ---------- סגירות ---------- */
  el('closeDayBtn').addEventListener('click', async () => {
    const date = el('closeDate').value;
    if (!date) return showMsg(el('closeMsg'), 'בחר תאריך', 'err');
    await Store.closeDay(date);
    showMsg(el('closeMsg'), `יום ${fmtDate(date)} נסגר לגמרי`, 'ok');
    loadBlocks(); loadAdminDays();
  });

  el('closeEarlyBtn').addEventListener('click', async () => {
    const date = el('closeDate').value;
    const from = el('closeFrom').value;
    if (!date || !from) return showMsg(el('closeMsg'), 'בחר תאריך ושעה', 'err');
    await Store.closeEarly(date, from);
    showMsg(el('closeMsg'), `ביום ${fmtDate(date)} סגור מהשעה ${from}`, 'ok');
    loadBlocks(); loadAdminDays();
  });

  el('blockRangeBtn').addEventListener('click', async () => {
    const date = el('closeDate').value;
    const from = el('blockFrom').value, to = el('blockTo').value;
    if (!date || !from || !to) return showMsg(el('closeMsg'), 'מלא תאריך ושעות', 'err');
    if (from >= to) return showMsg(el('closeMsg'), 'שעת סיום חייבת להיות אחרי ההתחלה', 'err');
    await Store.addBlock({ date, from, to });
    showMsg(el('closeMsg'), `נחסם ${from}–${to} ביום ${fmtDate(date)}`, 'ok');
    loadBlocks(); loadAdminDays();
  });

  async function loadBlocks() {
    const box = el('blocksList');
    const blocks = (await Store.getBlocks()).slice().sort((a,b)=> (a.date||'').localeCompare(b.date||''));
    if (!blocks.length) { box.innerHTML = '<div class="empty-note">אין סגירות.</div>'; return; }
    box.innerHTML = '';
    blocks.forEach(b => {
      const row = document.createElement('div');
      row.className = 'booking-row';
      const desc = b.allDay ? 'יום סגור לגמרי' : `סגור ${b.from}–${b.to}`;
      row.innerHTML = `<div class="time">${fmtDate(b.date)}</div>
                       <div class="info"><div class="nm">${desc}</div></div>
                       <button class="btn secondary small">בטל סגירה</button>`;
      row.querySelector('button').addEventListener('click', async () => {
        await Store.removeBlock(b.id);
        loadBlocks(); loadAdminDays();
      });
      box.appendChild(row);
    });
  }

  /* ---------- הגדרות ---------- */
  async function loadSettings() {
    const s = await Store.getSettings();
    const box = el('dayHours');
    box.innerHTML = '';
    Store.DAY_NAMES.forEach((name, wd) => {
      const on = s.workDays.includes(wd);
      const dh = (s.dayHours && s.dayHours[wd]) || {};
      const start = dh.start || s.startTime || '11:00';
      const end   = dh.end   || s.endTime   || '19:00';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';
      row.innerHTML =
        '<label style="flex:0 0 96px;display:flex;align-items:center;gap:6px;font-size:14px;color:var(--text)">' +
          '<input type="checkbox" data-day="' + wd + '"' + (on ? ' checked' : '') + ' style="width:auto"> ' + name + '</label>' +
        '<input type="time" step="300" data-start="' + wd + '" value="' + start + '" style="flex:1">' +
        '<span style="color:var(--muted)">–</span>' +
        '<input type="time" step="300" data-end="' + wd + '" value="' + end + '" style="flex:1">';
      box.appendChild(row);
    });
    el('slotMin').value = String(s.slotMinutes || 10);
    el('bizNameIn').value = s.businessName || '';
    el('bookAhead').value = s.bookAheadDays || 21;

    if (window.DavidTheme) { window.DavidTheme.apply(s.theme); renderThemes(s.theme); }
  }

  /* ---------- בורר ערכות עיצוב ---------- */
  function renderThemes(current) {
    const grid = el('themeGrid');
    if (!grid || !window.DavidTheme) return;
    const cur = window.DavidTheme.normalize(current);
    grid.innerHTML = '';
    window.DavidTheme.THEMES.forEach(t => {
      const opt = document.createElement('div');
      opt.className = 'theme-opt' + (t.id === cur ? ' on' : '');
      opt.innerHTML =
        '<div class="sw" style="background:' + t.bg + '"><div class="dot" style="background:' + t.accent + '"></div></div>' +
        '<div class="nm">' + t.name + '</div>';
      opt.addEventListener('click', async () => {
        window.DavidTheme.apply(t.id);   // חל מיד על הפאנל
        grid.querySelectorAll('.theme-opt').forEach(x => x.classList.remove('on'));
        opt.classList.add('on');
        try {
          await Store.saveSettings({ theme: t.id });
          showMsg(el('settingsMsg'), '✅ העיצוב עודכן — ' + t.name, 'ok');
        } catch (e) {
          showMsg(el('settingsMsg'), 'העיצוב לא נשמר, נסו שוב', 'err');
        }
      });
      grid.appendChild(opt);
    });
  }

  el('saveSettingsBtn').addEventListener('click', async () => {
    const days = [], dayHours = {};
    let bad = '';
    document.querySelectorAll('#dayHours input[type=checkbox]').forEach(chk => {
      if (!chk.checked) return;
      const wd = Number(chk.dataset.day);
      const start = document.querySelector('#dayHours input[data-start="' + wd + '"]').value;
      const end   = document.querySelector('#dayHours input[data-end="' + wd + '"]').value;
      if (!start || !end || start >= end) { bad = bad || Store.DAY_NAMES[wd]; return; }
      days.push(wd); dayHours[wd] = { start, end };
    });
    if (!days.length) return showMsg(el('settingsMsg'), 'בחר לפחות יום עבודה אחד', 'err');
    if (bad) return showMsg(el('settingsMsg'), 'שעות לא תקינות ביום ' + bad + ' (הסיום חייב להיות אחרי ההתחלה)', 'err');
    const slotMinutes = Math.max(5, Math.min(120, parseInt(el('slotMin').value) || 10));
    const starts = days.map(d => dayHours[d].start).sort();
    const ends   = days.map(d => dayHours[d].end).sort();
    await Store.saveSettings({
      workDays: days.sort((a,b) => a - b),
      dayHours,
      slotMinutes,
      startTime: starts[0],
      endTime: ends[ends.length - 1],
      businessName: el('bizNameIn').value.trim() || 'דוד הספר',
      bookAheadDays: Math.max(1, Math.min(90, parseInt(el('bookAhead').value) || 21))
    });
    showMsg(el('settingsMsg'), '✅ ההגדרות נשמרו', 'ok');
    loadAdminDays();
  });

  const _savePwBtn = el('savePwBtn');   // מושבת בהדגמה — קיים רק אם הכפתור נמצא ב-HTML
  if (_savePwBtn) _savePwBtn.addEventListener('click', async () => {
    const npw = el('newPw').value.trim();
    if (npw.length < 3) return showMsg(el('settingsMsg'), 'סיסמה קצרה מדי (לפחות 3 תווים)', 'err');
    await Store.saveSettings({ adminPassword: npw });
    // המכשיר שביצע את השינוי יישאר מחובר: מעדכנים את הסיסמה הפעילה (בזיכרון) ואת זו השמורה במכשיר.
    // (מכשירים אחרים עדיין יצטרכו להזין את החדשה בכניסה הבאה — זה בלתי נמנע בסיסמה משותפת.)
    await Store.checkPassword(npw);
    try { localStorage.setItem(PW_KEY, npw); } catch (e) {}
    el('newPw').value = '';
    showMsg(el('settingsMsg'), '✅ הסיסמה עודכנה', 'ok');
  });

  /* ---------- התנתקות ---------- */
  function logout() {
    try { localStorage.removeItem(PW_KEY); } catch (e) {}
    location.reload();
  }
  const logoutBtn = el('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  /* ---------- כניסה אוטומטית אם כבר מחובר (נשמר במכשיר) ---------- */
  (async function autoLogin() {
    let saved = null;
    try { saved = localStorage.getItem(PW_KEY); } catch (e) {}
    if (!saved) return;
    if (await Store.checkPassword(saved)) openPanel();
    else { try { localStorage.removeItem(PW_KEY); } catch (e) {} }
  })();

})();
