(function () {
  'use strict';

  const API = '/api';
  const USER_ID = 'default';

  const INTENSITY_COLORS = {
    1: '#4F7259', 2: '#5C8267', 3: '#84AC82',
    4: '#D3B15E', 5: '#D0A050', 6: '#D0813F',
    7: '#C9713F', 8: '#BD5F4A',
    9: '#B24F55', 10: '#8F3E48'
  };

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

  const state = {
    year: 0,
    month: 0,
    crises: {},
    selectedDate: null,
    editingDate: null,
  };

  /* ---------- helpers ---------- */
  const $ = id => document.getElementById(id);
  const pad2 = n => String(n).padStart(2, '0');
  const fmtDate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const apiURL = (path, qs) => API + path + (qs ? '?' + qs : '');

  function getIntensityColor(v) {
    if (v <= 0) return null;
    if (v <= 3) return INTENSITY_COLORS[v] || INTENSITY_COLORS[3];
    if (v <= 6) return INTENSITY_COLORS[v] || INTENSITY_COLORS[6];
    if (v <= 8) return INTENSITY_COLORS[v] || INTENSITY_COLORS[8];
    return INTENSITY_COLORS[v] || INTENSITY_COLORS[10];
  }

  function getIntensityHex(v) {
    const map = [
      null, '#4F7259', '#5C8267', '#84AC82',
      '#D3B15E', '#D0A050', '#D0813F',
      '#C9713F', '#BD5F4A',
      '#B24F55', '#8F3E48'
    ];
    return map[v] || null;
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  /* ---------- custom confirm ---------- */
  function showConfirm(msg) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <p>${msg}</p>
          <div class="confirm-actions">
            <button class="btn-secondary" id="cnf-cancel">Cancelar</button>
            <button class="btn-primary" id="cnf-ok">Confirmar</button>
          </div>
        </div>`;
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

  async function fetchMonth(year, month) {
    const prefix = `/crises/${USER_ID}/month`;
    const qs = `year=${year}&month=${month + 1}`;
    return api('GET', prefix + '?' + qs);
  }

  async function saveCrisis(date, data) {
    return api('PUT', `/crises/${USER_ID}/${date}`, data);
  }

  async function deleteCrisis(date) {
    return api('DELETE', `/crises/${USER_ID}/${date}`);
  }

  /* ---------- calendar ---------- */
  async function renderCalendar() {
    const grid = $('calendar-grid');
    const loading = $('calendar-loading');
    grid.innerHTML = '';
    loading.style.display = 'block';

    // day headers
    DAY_NAMES.forEach(name => {
      const el = document.createElement('div');
      el.className = 'calendar-day-header';
      el.textContent = name;
      grid.appendChild(el);
    });

    const firstDay = new Date(state.year, state.month, 1).getDay();
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const today = new Date();

    // empty cells
    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'calendar-day empty';
      grid.appendChild(el);
    }

    // fetch data
    try {
      state.crises = await fetchMonth(state.year, state.month);
    } catch (e) {
      console.error('fetch month error:', e);
    }
    loading.style.display = 'none';

    // day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = fmtDate(state.year, state.month, d);
      const crisis = state.crises[dateStr];
      const isToday =
        state.year === today.getFullYear() &&
        state.month === today.getMonth() &&
        d === today.getDate();

      const el = document.createElement('div');
      el.className = 'calendar-day';

      if (isToday) el.classList.add('today');
      if (crisis && crisis.intensidade > 0) {
        el.classList.add('has-crisis');
        const color = getIntensityHex(crisis.intensidade);
        if (color) el.style.background = color;
      }

      const span = document.createElement('span');
      span.className = 'day-num';
      span.textContent = d;
      el.appendChild(span);
      el.dataset.date = dateStr;
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
    const dateInput = $('form-date');
    const intensity = $('form-intensity');
    const timeInput = $('form-time');
    const medCheck = $('form-medication');
    const hospitalCheck = $('form-hospital');
    const triggerCheck = $('form-trigger');
    const triggerDesc = $('form-trigger-desc');

    $('medication-detail').classList.add('hidden');
    $('trigger-detail').classList.add('hidden');

    if (crisis) {
      title.textContent = 'Editar Crise';
      dateInput.value = crisis.data || dateStr;
      intensity.value = crisis.intensidade;
      timeInput.value = crisis.hora_inicio || '';
      medCheck.checked = !!crisis.tomou_medicamento;
      hospitalCheck.checked = !!crisis.foi_hospital;
      triggerCheck.checked = !!crisis.teve_gatilho;
      triggerDesc.value = crisis.gatilho || '';

      if (crisis.tomou_medicamento) {
        $('medication-detail').classList.remove('hidden');
      }
      if (crisis.teve_gatilho) {
        $('trigger-detail').classList.remove('hidden');
      }

      // medicines
      const container = $('medicines-container');
      container.innerHTML = '';
      const meds = Array.isArray(crisis.medicamentos) && crisis.medicamentos.length
        ? crisis.medicamentos : [''];
      meds.forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'medicine-row';
        row.innerHTML = `<input type="text" class="medicine-input" placeholder="Ex: Dipirona 1g" value="${m.replace(/"/g, '&quot;')}">`;
        container.appendChild(row);
      });
    } else {
      title.textContent = 'Nova Crise';
      dateInput.value = dateStr;
      intensity.value = 5;
      timeInput.value = '';
      medCheck.checked = false;
      hospitalCheck.checked = false;
      triggerCheck.checked = false;
      triggerDesc.value = '';
      $('medicines-container').innerHTML = `
        <div class="medicine-row">
          <input type="text" class="medicine-input" placeholder="Ex: Dipirona 1g">
        </div>`;
    }

    updateIntensityDisplay(intensity.value);
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
    const intensity = $('form-intensity');
    intensity.addEventListener('input', () => updateIntensityDisplay(intensity.value));

    $('form-medication').addEventListener('change', function () {
      $('medication-detail').classList.toggle('hidden', !this.checked);
    });

    $('form-trigger').addEventListener('change', function () {
      $('trigger-detail').classList.toggle('hidden', !this.checked);
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

      const medicineInputs = document.querySelectorAll('.medicine-input');
      const medicamentos = [];
      medicineInputs.forEach(inp => {
        const v = inp.value.trim();
        if (v) medicamentos.push(v);
      });

      const data = {
        data: date,
        intensidade: parseInt($('form-intensity').value, 10),
        hora_inicio: $('form-time').value || '',
        tomou_medicamento: $('form-medication').checked,
        medicamentos,
        foi_hospital: $('form-hospital').checked,
        teve_gatilho: $('form-trigger').checked,
        gatilho: $('form-trigger-desc').value.trim()
      };

      const btn = $('form-save');
      btn.disabled = true;
      btn.textContent = 'Salvando...';

      try {
        await saveCrisis(date, data);
        showToast('Crise registrada!');
        closeForm();
        renderCalendar();
      } catch (e) {
        showToast('Erro ao salvar: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
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
  async function openDetail(dateStr) {
    const body = $('detail-body');
    const title = $('detail-title');

    try {
      const crisis = state.crises[dateStr] || await api('GET', `/crises/${USER_ID}/${dateStr}`);
      if (!crisis) { showToast('Registro não encontrado'); return; }

      const d = crisis.data || dateStr;
      const parts = d.split('-');
      const displayDate = `${parseInt(parts[2])} de ${MONTHS[parseInt(parts[1]) - 1]} de ${parts[0]}`;
      title.textContent = displayDate;

      const color = getIntensityHex(crisis.intensidade);
      const intensityLabel = INTENSITY_LABELS[crisis.intensidade] || crisis.intensidade;

      body.innerHTML = `
        <div class="detail-row">
          <span class="detail-label">Intensidade</span>
          <span class="detail-value">
            <span class="detail-intensity">
              <span class="detail-intensity-dot" style="background:${color || '#555'}"></span>
              ${crisis.intensidade}/10 — ${intensityLabel}
            </span>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Horário de início</span>
          <span class="detail-value">${crisis.hora_inicio || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Medicamento</span>
          <span class="detail-value">${crisis.tomou_medicamento ? (crisis.medicamentos || []).join(', ') || 'Sim' : 'Não'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Hospital</span>
          <span class="detail-value">${crisis.foi_hospital ? 'Sim' : 'Não'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Gatilho</span>
          <span class="detail-value">${crisis.teve_gatilho ? (crisis.gatilho || 'Descrito') : 'Não'}</span>
        </div>`;

      state.selectedDate = dateStr;
      showScreen('detail-screen');
    } catch (e) {
      showToast('Erro ao carregar: ' + e.message);
    }
  }

  function setupDetail() {
    $('detail-edit').addEventListener('click', () => {
      const date = state.selectedDate;
      if (!date) return;
      const crisis = state.crises[date];
      showScreen('main-screen');
      openForm(date, crisis);
    });

    $('detail-delete').addEventListener('click', async () => {
      const date = state.selectedDate;
      if (!date) return;
      const ok = await showConfirm('Tem certeza que deseja apagar este registro?');
      if (!ok) return;
      try {
        await deleteCrisis(date);
        showToast('Registro apagado');
        delete state.crises[date];
        showScreen('main-screen');
        renderCalendar();
      } catch (e) {
        showToast('Erro ao apagar: ' + e.message);
      }
    });

    $('detail-close').addEventListener('click', () => {
      showScreen('main-screen');
    });
  }

  /* ---------- FAB ---------- */
  function setupFAB() {
    $('fab-today').addEventListener('click', () => {
      const today = new Date();
      const dateStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
      // ensure calendar is on current month
      state.year = today.getFullYear();
      state.month = today.getMonth();
      renderCalendar();
      openForm(dateStr, null);
    });
  }

  /* ---------- navigation ---------- */
  function setupNav() {
    $('prev-month').addEventListener('click', () => navigateMonth(-1));
    $('next-month').addEventListener('click', () => navigateMonth(1));
  }

  /* ---------- init ---------- */
  function initApp() {
    const now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    showScreen('main-screen');
    renderCalendar();
  }

  /* ---------- register SW ---------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  /* ---------- setup & go ---------- */
  setupForm();
  setupDetail();
  setupFAB();
  setupNav();
  initApp();

})();
