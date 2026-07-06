(function () {
  'use strict';

  const API = '/api';
  const USER_ID = 'default';
  const OFFLINE_DB = 'de_offline';
  const OFFLINE_STORE = 'pending';

  const INTENSITY_LABELS = [
    'Sem dor', 'Mínima', 'Muito leve', 'Leve',
    'Leve-Moderada', 'Moderada', 'Moderada-Forte',
    'Forte', 'Muito forte', 'Intensa', 'Insuportável'
  ];

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const INTENSITY_HEX = [
    null, '#4F7259', '#5C8267', '#84AC82',
    '#D3B15E', '#D0A050', '#D0813F',
    '#C9713F', '#BD5F4A',
    '#B24F55', '#8F3E48'
  ];

  const SINTMAS_MAP = {
    nausea: 'Náusea', vomito: 'Vômito', fotofobia: 'Sensib. à luz',
    fonofobia: 'Sensib. ao som', aura: 'Aura', tontura: 'Tontura'
  };

  const state = {
    year: 0, month: 0, crises: {},
    selectedDate: null, editingDate: null,
    extraCrises: {}
  };

  /* ---------- helpers ---------- */
  const $ = id => document.getElementById(id);
  const pad2 = n => String(n).padStart(2, '0');
  const fmtDate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const apiURL = (path, qs) => API + path + (qs ? '?' + qs : '');
  const getIntensityHex = v => INTENSITY_HEX[v] || null;

  /* ---------- toast ---------- */
  let toastTimer = null;
  function showToast(msg, type) {
    const el = $('toast');
    el.textContent = msg; el.className = 'toast';
    if (type) el.classList.add(type);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  /* ---------- error banner ---------- */
  let errorResolve = null;
  function showError(msg) {
    const banner = $('error-banner');
    $('error-msg').textContent = msg;
    banner.classList.remove('hidden');
    banner.classList.add('show');
    return new Promise(resolve => { errorResolve = resolve; });
  }
  function hideError() {
    const banner = $('error-banner');
    banner.classList.remove('show');
    banner.classList.add('hidden');
  }
  $('error-retry').addEventListener('click', () => {
    hideError();
    if (errorResolve) { errorResolve(); errorResolve = null; }
  });

  /* ---------- custom confirm ---------- */
  function showConfirm(msg) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box"><p>${msg}</p>
        <div class="confirm-actions">
          <button class="btn-secondary" id="cnf-cancel">Cancelar</button>
          <button class="btn-primary" id="cnf-ok">Confirmar</button>
        </div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#cnf-ok').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('#cnf-cancel').onclick = () => { overlay.remove(); resolve(false); };
    });
  }

  /* ---------- screen navigation ---------- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  /* ---------- offline queue ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(OFFLINE_DB, 1);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
          db.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      r.onsuccess = e => resolve(e.target.result);
      r.onerror = e => reject(e.target.error);
    });
  }

  async function queueOffline(method, path, body) {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).add({ method, path, body, createdAt: Date.now() });
    return new Promise(r => { tx.oncomplete = () => r(); });
  }

  async function flushOfflineQueue() {
    const db = await openDB();
    const tx = db.transaction(OFFLINE_STORE, 'readonly');
    const store = tx.objectStore(OFFLINE_STORE);
    const all = await new Promise(r => { const req = store.getAll(); req.onsuccess = () => r(req.result); });
    if (!all.length) return;

    for (const item of all) {
      try {
        await api(item.method, item.path, item.body);
      } catch { return; }
    }

    const tx2 = db.transaction(OFFLINE_STORE, 'readwrite');
    tx2.objectStore(OFFLINE_STORE).clear();
    await new Promise(r => { tx2.oncomplete = () => r(); });
    if (all.length > 0) showToast(`${all.length} registro(s) sincronizado(s)`, 'success');
  }

  /* ---------- API calls ---------- */
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(apiURL(path), opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  }

  async function withRetry(fn, label) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fn();
        hideError();
        return result;
      } catch (e) {
        if (attempt === 0) {
          await showError(`${label}: ${e.message}`);
          continue;
        }
        throw e;
      }
    }
  }

  async function fetchMonth(year, month) {
    const qs = `year=${year}&month=${month + 1}`;
    return api('GET', `/crises/${USER_ID}/month?${qs}`);
  }

  async function saveCrisis(date, data) {
    return api('PUT', `/crises/${USER_ID}/${date}`, data);
  }

  async function deleteCrisis(date) {
    return api('DELETE', `/crises/${USER_ID}/${date}`);
  }

  /* ---------- collect triggers from loaded data ---------- */
  function collectTriggers() {
    const all = { ...state.crises, ...state.extraCrises };
    const freq = {};
    Object.values(all).forEach(c => {
      if (c.teve_gatilho && c.gatilho) {
        const t = c.gatilho.trim().toLowerCase();
        if (t) freq[t] = (freq[t] || 0) + 1;
      }
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }

  function collectMedicineUsage(daysBack) {
    const all = { ...state.crises, ...state.extraCrises };
    const cutoff = Date.now() - daysBack * 86400000;
    const freq = {};
    Object.entries(all).forEach(([date, c]) => {
      if (new Date(date) < new Date(cutoff)) return;
      if (c.tomou_medicamento && Array.isArray(c.medicamentos)) {
        c.medicamentos.forEach(m => {
          if (m.trim()) freq[m.trim()] = (freq[m.trim()] || 0) + 1;
        });
      }
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  }

  /* ---------- calendar ---------- */
  async function renderCalendar() {
    const grid = $('calendar-grid');
    const loading = $('calendar-loading');
    grid.innerHTML = '';
    loading.style.display = 'block';

    DAY_NAMES.forEach(name => {
      const el = document.createElement('div');
      el.className = 'calendar-day-header'; el.textContent = name; grid.appendChild(el);
    });

    const firstDay = new Date(state.year, state.month, 1).getDay();
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const today = new Date();

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'calendar-day empty'; grid.appendChild(el);
    }

    try {
      state.crises = await withRetry(() => fetchMonth(state.year, state.month), 'Erro ao carregar mês');
    } catch { state.crises = {}; }
    loading.style.display = 'none';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = fmtDate(state.year, state.month, d);
      const crisis = state.crises[dateStr];
      const isToday = state.year === today.getFullYear() && state.month === today.getMonth() && d === today.getDate();

      const el = document.createElement('div');
      el.className = 'calendar-day';
      if (isToday) el.classList.add('today');
      if (crisis && crisis.intensidade > 0) {
        el.classList.add('has-crisis');
        const color = getIntensityHex(crisis.intensidade);
        if (color) el.style.background = color;
      }
      const span = document.createElement('span');
      span.className = 'day-num'; span.textContent = d;
      el.appendChild(span); el.dataset.date = dateStr;
      el.addEventListener('click', () => onDayClick(dateStr));
      grid.appendChild(el);
    }

    $('month-title').textContent = `${MONTHS[state.month]} ${state.year}`;
  }

  function onDayClick(dateStr) {
    state.selectedDate = dateStr;
    if (state.crises[dateStr]) {
      openDetail(dateStr);
    } else {
      openForm(dateStr, null);
    }
  }

  function navigateMonth(delta) {
    state.month += delta;
    if (state.month < 0) { state.month = 11; state.year--; }
    if (state.month > 11) { state.month = 0; state.year++; }
    renderCalendar();
  }

  /* ---------- form ---------- */
  function openForm(dateStr, crisis) {
    state.editingDate = dateStr;
    const title = $('form-title');
    $('form-date').value = dateStr;
    $('form-intensity').value = crisis ? crisis.intensidade : 5;
    $('form-time').value = crisis ? (crisis.hora_inicio || '') : '';
    $('form-end-time').value = crisis ? (crisis.hora_fim || '') : '';
    $('form-still-ongoing').checked = crisis ? !!crisis.em_andamento : false;
    $('form-end-time').disabled = $('form-still-ongoing').checked;

    // medication
    $('form-medication').checked = crisis ? !!crisis.tomou_medicamento : false;
    $('medication-detail').classList.toggle('hidden', !$('form-medication').checked);

    const container = $('medicines-container');
    container.innerHTML = '';
    const meds = crisis && Array.isArray(crisis.medicamentos) && crisis.medicamentos.length
      ? crisis.medicamentos : [''];
    meds.forEach(m => {
      const row = document.createElement('div');
      row.className = 'medicine-row';
      row.innerHTML = `<input type="text" class="medicine-input" placeholder="Ex: Dipirona 1g" value="${(m || '').replace(/"/g, '&quot;')}">`;
      container.appendChild(row);
    });

    // eficacia radios
    document.querySelectorAll('[name="form-eficacia"]').forEach(r => r.checked = false);
    if (crisis && crisis.eficacia) {
      const r = document.querySelector(`[name="form-eficacia"][value="${crisis.eficacia}"]`);
      if (r) r.checked = true;
    } else {
      const r = document.querySelector('[name="form-eficacia"][value="nao_funcionou"]');
      if (r) r.checked = true;
    }

    // sintomas chips
    document.querySelectorAll('#symptoms-chips .chip').forEach(c => {
      c.classList.toggle('selected', crisis && Array.isArray(crisis.sintomas) && crisis.sintomas.includes(c.dataset.value));
    });

    // piora atividade
    document.querySelectorAll('[name="form-atividade"]').forEach(r => r.checked = false);
    const atv = crisis ? (crisis.piora_atividade || 'nao') : 'nao';
    document.querySelectorAll('[name="form-atividade"]').forEach(r => { if (r.value === atv) r.checked = true; });

    // hospital
    $('form-hospital').checked = crisis ? !!crisis.foi_hospital : false;

    // impacto
    $('form-impacto').checked = crisis ? !!crisis.impacto_dia : false;

    // trigger
    $('form-trigger').checked = crisis ? !!crisis.teve_gatilho : false;
    $('form-trigger-desc').value = crisis ? (crisis.gatilho || '') : '';
    $('trigger-detail').classList.toggle('hidden', !$('form-trigger').checked);

    // trigger chips
    const chipsContainer = $('trigger-chips');
    const triggers = collectTriggers();
    chipsContainer.innerHTML = '';
    triggers.forEach(([t]) => {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip';
      chip.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      chip.addEventListener('click', () => {
        const existing = $('form-trigger-desc').value;
        const words = existing ? existing.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (!words.includes(t)) {
          words.push(t);
          $('form-trigger-desc').value = words.join(', ');
        }
      });
      chipsContainer.appendChild(chip);
    });

    title.textContent = crisis ? 'Editar Crise' : 'Nova Crise';
    updateIntensityDisplay($('form-intensity').value);
    showScreen('form-screen');
  }

  function updateIntensityDisplay(val) {
    const v = parseInt(val, 10);
    $('intensity-value').textContent = v;
    $('intensity-desc').textContent = INTENSITY_LABELS[v] || '';
    const fill = $('intensity-fill');
    const pct = (v / 10) * 100;
    fill.style.width = pct + '%';
    const color = getIntensityHex(v);
    if (color) fill.style.background = color;
  }

  function setupForm() {
    $('form-intensity').addEventListener('input', function () {
      updateIntensityDisplay(this.value);
    });

    $('form-medication').addEventListener('change', function () {
      $('medication-detail').classList.toggle('hidden', !this.checked);
    });

    $('form-trigger').addEventListener('change', function () {
      $('trigger-detail').classList.toggle('hidden', !this.checked);
    });

    $('form-still-ongoing').addEventListener('change', function () {
      $('form-end-time').disabled = this.checked;
      if (this.checked) $('form-end-time').value = '';
    });

    // chips toggle
    document.querySelectorAll('#symptoms-chips .chip').forEach(c => {
      c.addEventListener('click', () => c.classList.toggle('selected'));
    });

    $('add-medicine').addEventListener('click', () => {
      const container = $('medicines-container');
      const row = document.createElement('div');
      row.className = 'medicine-row';
      row.innerHTML = '<input type="text" class="medicine-input" placeholder="Ex: Dipirona 1g">';
      container.appendChild(row);
      row.querySelector('input').focus();
    });

    $('crisis-form').addEventListener('submit', async e => {
      e.preventDefault();
      const date = $('form-date').value;
      if (!date) return;

      const medInputs = document.querySelectorAll('.medicine-input');
      const medicamentos = [];
      medInputs.forEach(inp => { const v = inp.value.trim(); if (v) medicamentos.push(v); });

      const sintomas = [];
      document.querySelectorAll('#symptoms-chips .chip.selected').forEach(c => sintomas.push(c.dataset.value));

      const eficaciaEl = document.querySelector('[name="form-eficacia"]:checked');
      const atividadeEl = document.querySelector('[name="form-atividade"]:checked');

      const body = {
        data: date,
        intensidade: parseInt($('form-intensity').value, 10),
        hora_inicio: $('form-time').value || '',
        hora_fim: $('form-end-time').value || '',
        em_andamento: $('form-still-ongoing').checked,
        sintomas,
        piora_atividade: atividadeEl ? atividadeEl.value : 'nao',
        tomou_medicamento: $('form-medication').checked,
        medicamentos,
        eficacia: eficaciaEl ? eficaciaEl.value : '',
        foi_hospital: $('form-hospital').checked,
        impacto_dia: $('form-impacto').checked,
        teve_gatilho: $('form-trigger').checked,
        gatilho: $('form-trigger-desc').value.trim()
      };

      const btn = $('form-save');
      btn.disabled = true; btn.textContent = 'Salvando...';

      try {
        await saveCrisis(date, body);
        showToast('Crise registrada!', 'success');
        closeForm();
        renderCalendar();
      } catch (e) {
        // offline? queue it
        if (!navigator.onLine || e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
          await queueOffline('PUT', `/crises/${USER_ID}/${date}`, body);
          showToast('Salvo offline — será sincronizado', 'offline');
          closeForm();
          renderCalendar();
        } else {
          showToast('Erro ao salvar: ' + e.message, 'error');
        }
      } finally {
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    });

    $('form-cancel').addEventListener('click', closeForm);
    $('form-close').addEventListener('click', closeForm);
  }

  function closeForm() {
    showScreen('main-screen');
    state.editingDate = null;
  }

  /* ---------- detail ---------- */
  function fmtSintomas(sintomas) {
    if (!Array.isArray(sintomas) || !sintomas.length) return '';
    return sintomas.map(s => SINTMAS_MAP[s] || s).join(', ');
  }

  async function openDetail(dateStr) {
    const body = $('detail-body');
    const title = $('detail-title');

    try {
      const crisis = state.crises[dateStr] || await withRetry(
        () => api('GET', `/crises/${USER_ID}/${dateStr}`),
        'Erro ao carregar'
      );
      if (!crisis) { showToast('Registro não encontrado'); return; }

      const d = crisis.data || dateStr;
      const parts = d.split('-');
      title.textContent = `${parseInt(parts[2])} de ${MONTHS[parseInt(parts[1]) - 1]} de ${parts[0]}`;

      const color = getIntensityHex(crisis.intensidade);
      const iLabel = INTENSITY_LABELS[crisis.intensidade] || crisis.intensidade;
      const sintomasHtml = fmtSintomas(crisis.sintomas);
      const eficaciaLabel = { funcionou: 'Sim', parcial: 'Parcial', nao_funcionou: 'Não' }[crisis.eficacia] || '';
      const pioraLabel = { sim: 'Sim', nao: 'Não', 'n/a': 'N/A' }[crisis.piora_atividade] || '';
      const duracao = crisis.em_andamento ? 'Em andamento' : (crisis.hora_fim ? `${crisis.hora_inicio} — ${crisis.hora_fim}` : crisis.hora_inicio);

      body.innerHTML = `
        <div class="detail-row"><span class="detail-label">Intensidade</span>
          <span class="detail-value"><span class="detail-intensity"><span class="detail-intensity-dot" style="background:${color || '#555'}"></span>${crisis.intensidade}/10 — ${iLabel}</span></span></div>
        <div class="detail-row"><span class="detail-label">Duração</span><span class="detail-value">${duracao || '—'}</span></div>
        ${sintomasHtml ? `<div class="detail-row"><span class="detail-label">Sintomas</span><span class="detail-value"><span class="detail-chips">${crisis.sintomas.map(s => `<span class="detail-chip">${SINTMAS_MAP[s] || s}</span>`).join(' ')}</span></span></div>` : ''}
        ${pioraLabel ? `<div class="detail-row"><span class="detail-label">Piora c/ atividade</span><span class="detail-value">${pioraLabel}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Medicamento</span><span class="detail-value">${crisis.tomou_medicamento ? ((crisis.medicamentos || []).join(', ') || 'Sim') : 'Não'}</span></div>
        ${eficaciaLabel ? `<div class="detail-row"><span class="detail-label">Eficácia</span><span class="detail-value">${eficaciaLabel}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">Hospital</span><span class="detail-value">${crisis.foi_hospital ? 'Sim' : 'Não'}</span></div>
        ${crisis.impacto_dia ? '<div class="detail-row"><span class="detail-label">Impacto</span><span class="detail-value">Perdeu compromisso</span></div>' : ''}
        <div class="detail-row"><span class="detail-label">Gatilho</span><span class="detail-value">${crisis.teve_gatilho ? (crisis.gatilho || 'Descrito') : 'Não'}</span></div>`;

      state.selectedDate = dateStr;
      showScreen('detail-screen');
    } catch { showToast('Erro ao carregar registro', 'error'); }
  }

  function setupDetail() {
    $('detail-edit').addEventListener('click', () => {
      const date = state.selectedDate;
      if (!date) return;
      showScreen('main-screen');
      openForm(date, state.crises[date]);
    });

    $('detail-delete').addEventListener('click', async () => {
      const date = state.selectedDate;
      if (!date) return;
      const ok = await showConfirm('Tem certeza que deseja apagar este registro?');
      if (!ok) return;
      try {
        await deleteCrisis(date);
        showToast('Registro apagado', 'success');
        delete state.crises[date];
        showScreen('main-screen');
        renderCalendar();
      } catch (e) {
        if (!navigator.onLine) {
          await queueOffline('DELETE', `/crises/${USER_ID}/${date}`);
          delete state.crises[date];
          showToast('Exclusão salva offline', 'offline');
          showScreen('main-screen');
          renderCalendar();
        } else {
          showToast('Erro ao apagar: ' + e.message, 'error');
        }
      }
    });

    $('detail-close').addEventListener('click', () => showScreen('main-screen'));
  }

  /* ---------- stats ---------- */
  async function openStats() {
    showScreen('stats-screen');
    $('stats-loading').style.display = 'block';
    $('stats-content').classList.add('hidden');

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    // fetch extra months if needed
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;
    const nextMonth = curMonth === 11 ? 0 : curMonth + 1;
    const nextYear = curMonth === 11 ? curYear + 1 : curYear;

    try {
      const [curData, prevData, nextData] = await Promise.all([
        fetchMonth(curYear, curMonth),
        fetchMonth(prevYear, prevMonth).catch(() => ({})),
        fetchMonth(nextYear, nextMonth).catch(() => ({}))
      ]);

      state.extraCrises = { ...prevData, ...nextData };

      const allCur = Object.values(curData).filter(c => c && c.intensidade > 0);
      const allPrev = Object.values(prevData).filter(c => c && c.intensidade > 0);
      const curCount = allCur.length;
      const prevCount = allPrev.length;

      const avgIntensity = curCount ? (allCur.reduce((s, c) => s + c.intensidade, 0) / curCount) : 0;

      // trigger freq
      const trigFreq = {};
      allCur.forEach(c => { if (c.teve_gatilho && c.gatilho) { const t = c.gatilho.trim().toLowerCase(); if (t) trigFreq[t] = (trigFreq[t] || 0) + 1; } });
      const topTrigger = Object.entries(trigFreq).sort((a, b) => b[1] - a[1])[0];

      // intensity distribution
      const dist = { '1-3': 0, '4-6': 0, '7-8': 0, '9-10': 0 };
      allCur.forEach(c => {
        if (c.intensidade <= 3) dist['1-3']++;
        else if (c.intensidade <= 6) dist['4-6']++;
        else if (c.intensidade <= 8) dist['7-8']++;
        else dist['9-10']++;
      });

      // med usage
      const meds = collectMedicineUsage(30);

      // render
      $('stats-loading').style.display = 'none';
      $('stats-content').classList.remove('hidden');

      const cards = $('stats-cards');
      cards.innerHTML = `
        <div class="stat-card"><div class="stat-card-value">${curCount}</div><div class="stat-card-label">Crises este mês</div></div>
        <div class="stat-card"><div class="stat-card-value">${prevCount}</div><div class="stat-card-label">Mês anterior</div></div>
        <div class="stat-card"><div class="stat-card-value">${avgIntensity ? avgIntensity.toFixed(1) : '—'}</div><div class="stat-card-label">Intensidade média</div></div>
        <div class="stat-card"><div class="stat-card-value">${topTrigger ? topTrigger[1] : '—'}</div><div class="stat-card-label">${topTrigger ? topTrigger[0].charAt(0).toUpperCase() + topTrigger[0].slice(1) : 'Nenhum gatilho'}</div></div>
        <div class="stat-card full" style="background:transparent;padding:0"></div>`;

      // intensity bar chart
      const barChart1 = $('bar-chart-intensity');
      const maxDist = Math.max(...Object.values(dist), 1);
      const distColors = { '1-3': 'var(--sev-2)', '4-6': 'var(--sev-3)', '7-8': 'var(--sev-4)', '9-10': 'var(--sev-5)' };
      barChart1.innerHTML = Object.entries(dist).map(([k, v]) =>
        `<div class="bar-chart-col"><div class="bar-chart-bar" style="height:${(v / maxDist) * 100}%;background:${distColors[k]}"></div><div class="bar-chart-label">${k}<br>${v}</div></div>`
      ).join('');

      // compare bar chart
      const barChart2 = $('bar-chart-compare');
      const maxCmp = Math.max(curCount, prevCount, 1);
      barChart2.innerHTML = `
        <div class="bar-chart-col"><div class="bar-chart-bar" style="height:${(curCount / maxCmp) * 100}%;background:var(--primary)"></div><div class="bar-chart-label">Este mês<br>${curCount}</div></div>
        <div class="bar-chart-col"><div class="bar-chart-bar" style="height:${(prevCount / maxCmp) * 100}%;background:var(--text3)"></div><div class="bar-chart-label">Mês ant.<br>${prevCount}</div></div>`;

      // med usage
      const medContainer = $('med-usage');
      if (meds.length) {
        const maxMed = meds[0][1];
        medContainer.innerHTML = meds.map(([name, count]) =>
          `<div class="med-row"><span class="med-name">${name}</span><div class="med-bar" style="width:${(count / maxMed) * 100}%"></div><span class="med-count">${count}</span></div>`
        ).join('');
      } else {
        medContainer.innerHTML = '<p style="color:var(--text3);font-size:14px">Nenhum medicamento registrado nos últimos 30 dias.</p>';
      }

    } catch (e) {
      $('stats-loading').style.display = 'none';
      $('stats-content').classList.remove('hidden');
      $('stats-cards').innerHTML = `<div class="stat-card full"><div class="stat-card-value">—</div><div class="stat-card-label">Erro ao carregar dados</div></div>`;
    }
  }

  /* ---------- FAB ---------- */
  function setupFAB() {
    $('fab-today').addEventListener('click', () => {
      const today = new Date();
      const dateStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
      state.year = today.getFullYear();
      state.month = today.getMonth();

      // check if already has crisis today → open edit
      if (state.crises[dateStr]) {
        openDetail(dateStr);
      } else {
        renderCalendar();
        openForm(dateStr, null);
      }
    });
  }

  /* ---------- navigation ---------- */
  function setupNav() {
    $('prev-month').addEventListener('click', () => navigateMonth(-1));
    $('next-month').addEventListener('click', () => navigateMonth(1));
    $('btn-stats').addEventListener('click', openStats);
    $('stats-close').addEventListener('click', () => showScreen('main-screen'));
  }

  /* ---------- init ---------- */
  async function initApp() {
    const now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    showScreen('main-screen');
    await renderCalendar();
    // try to flush offline queue silently
    flushOfflineQueue().catch(() => {});
  }

  /* ---------- service worker ---------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  /* ---------- online/offline detection ---------- */
  window.addEventListener('online', () => {
    showToast('Conexão restaurada', 'success');
    flushOfflineQueue().catch(() => {});
  });

  /* ---------- setup & go ---------- */
  setupForm();
  setupDetail();
  setupFAB();
  setupNav();
  initApp();

})();
