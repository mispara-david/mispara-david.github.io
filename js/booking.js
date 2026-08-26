/* דוד הספר – לוגיקת דף הלקוחות */
(function () {
  'use strict';

  const el = id => document.getElementById(id);
  const daysBox = el('days');
  const slotsBox = el('slots');
  const pickSummary = el('pickSummary');
  const nameIn = el('name');
  const phoneIn = el('phone');
  const bookBtn = el('bookBtn');
  const msg = el('msg');

  let selectedDate = null;
  let selectedTime = null;

  function showMsg(text, type) {
    msg.textContent = text;
    msg.className = 'msg show ' + type;
  }
  function clearMsg() { msg.className = 'msg'; }

  function fmtDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  }

  function updateSummary() {
    if (selectedDate && selectedTime) {
      pickSummary.innerHTML =
        `נבחר: יום <b>${Store.DAY_NAMES[Store.weekdayOf(selectedDate)]}</b>, ` +
        `<b>${fmtDate(selectedDate)}</b>, בשעה <b>${selectedTime}</b>`;
    } else if (selectedDate) {
      pickSummary.innerHTML = `יום <b>${Store.DAY_NAMES[Store.weekdayOf(selectedDate)]}</b> נבחר – עכשיו בחר שעה.`;
    } else {
      pickSummary.textContent = 'עדיין לא נבחר תור.';
    }
    refreshBtn();
  }

  function refreshBtn() {
    bookBtn.disabled = !(selectedDate && selectedTime && nameIn.value.trim() && phoneIn.value.trim());
  }

  function showPhoneFallback() {
    const phone = (window.DAVID_PHONE || '').trim();
    daysBox.className = '';
    daysBox.innerHTML =
      '<div class="msg err show" style="text-align:center">' +
      'לא ניתן להתחבר לקביעת תור אונליין כרגע' +
      (phone ? '<br><br>לקביעת תור התקשרו:<br><a href="tel:' + phone + '" style="font-size:22px;color:var(--accent);font-weight:700;direction:ltr;display:inline-block;margin-top:6px">' + phone + '</a>' : '') +
      '</div>';
    document.getElementById('slotsCard').classList.add('hidden');
    document.getElementById('formCard').classList.add('hidden');
  }

  async function loadDays() {
    let s;
    try { s = await Store.getSettings(); }
    catch (e) { showPhoneFallback(); return; }
    if (window.DavidTheme) window.DavidTheme.apply(s.theme);
    el('bizName').textContent = s.businessName || 'המספרה של שמשון';
    const sm = s.slotMinutes || 10, subEl = el('subTitle');
    if (subEl) subEl.textContent = 'קביעת תור אונליין · כל תור ' + (sm === 60 ? 'שעה' : sm + ' דקות');

    const days = await Store.upcomingOpenDays();
    if (!days.length) {
      daysBox.innerHTML = '<div class="empty-note">אין ימים פנויים כרגע. נסה שוב מאוחר יותר.</div>';
      return;
    }
    daysBox.innerHTML = '';
    days.forEach(d => {
      const div = document.createElement('div');
      div.className = 'day';
      const free = d.freeCount > 0
        ? `${d.freeCount} תורים פנויים`
        : 'מלא';
      div.innerHTML = `<div class="dname">${d.dayName}</div>
                       <div class="ddate">${fmtDate(d.date)}</div>
                       <div class="dfree">${free}</div>`;
      if (d.freeCount === 0) div.style.opacity = '.5';
      div.addEventListener('click', () => selectDay(d.date, div));
      daysBox.appendChild(div);
    });
  }

  async function selectDay(dateStr, div) {
    document.querySelectorAll('.day').forEach(x => x.classList.remove('active'));
    div.classList.add('active');
    selectedDate = dateStr;
    selectedTime = null;
    clearMsg();
    await loadSlots(dateStr);
    updateSummary();
  }

  async function loadSlots(dateStr) {
    slotsBox.className = '';
    slotsBox.innerHTML = '<div class="spinner">טוען שעות…</div>';
    const slots = await Store.getAvailableSlots(dateStr);
    if (!slots.length) {
      slotsBox.className = 'empty-note';
      slotsBox.textContent = 'אין שעות פנויות ביום הזה. בחר יום אחר.';
      return;
    }
    slotsBox.className = 'slots';
    slotsBox.innerHTML = '';
    slots.forEach(time => {
      const b = document.createElement('div');
      b.className = 'slot';
      b.textContent = time;
      b.addEventListener('click', () => {
        document.querySelectorAll('.slot').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        selectedTime = time;
        updateSummary();
      });
      slotsBox.appendChild(b);
    });
  }

  async function doBook() {
    clearMsg();
    if (!selectedDate || !selectedTime) { showMsg('בחר יום ושעה', 'err'); return; }
    bookBtn.disabled = true;
    bookBtn.textContent = 'קובע…';

    const res = await Store.book({
      date: selectedDate,
      time: selectedTime,
      name: nameIn.value,
      phone: phoneIn.value,
      source: 'web'
    });

    bookBtn.textContent = 'קבע תור';
    if (res.ok) {
      showMsg(
        `✅ התור נקבע! יום ${Store.DAY_NAMES[Store.weekdayOf(selectedDate)]} ` +
        `${fmtDate(selectedDate)} בשעה ${selectedTime}. נתראה, ${res.booking.name}!`,
        'ok'
      );
      // איפוס והתחלה מחדש
      selectedTime = null;
      nameIn.value = '';
      phoneIn.value = '';
      await loadSlots(selectedDate);
      await loadDays();
      updateSummary();
    } else {
      showMsg('❌ ' + res.error, 'err');
      // אם התור נתפס בינתיים – רענון השעות
      if (res.error.includes('נתפס')) {
        selectedTime = null;
        await loadSlots(selectedDate);
        await loadDays();
      }
      refreshBtn();
    }
  }

  nameIn.addEventListener('input', refreshBtn);
  phoneIn.addEventListener('input', refreshBtn);
  bookBtn.addEventListener('click', doBook);

  loadDays();
})();
