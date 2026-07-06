import { $, state, DAY_NAMES, MONTHS, fmtDate, getIntensityHex } from './state.js';
import { withRetry, fetchMonth } from './api.js';

export async function renderCalendar() {
  const grid = $('calendar-grid');
  const loading = $('calendar-loading');
  loading.style.display = 'block';

  const firstDay = new Date(state.year, state.month, 1).getDay();
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const today = new Date();

  try {
    state.crises = await withRetry(() => fetchMonth(state.year, state.month), 'Erro ao carregar mês');
  } catch { state.crises = {}; }
  loading.style.display = 'none';

  requestAnimationFrame(() => {
    const fragment = document.createDocumentFragment();

    DAY_NAMES.forEach(name => {
      const el = document.createElement('div');
      el.className = 'calendar-day-header'; el.textContent = name; fragment.appendChild(el);
    });

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'calendar-day empty'; fragment.appendChild(el);
    }

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
      fragment.appendChild(el);
    }

    grid.innerHTML = '';
    grid.appendChild(fragment);
    $('month-title').textContent = `${MONTHS[state.month]} ${state.year}`;
  });
}

function onDayClick(dateStr) {
  state.selectedDate = dateStr;
  if (state.crises[dateStr]) {
    _openDetail(dateStr);
  } else {
    _openForm(dateStr, null);
  }
}

export function navigateMonth(delta) {
  state.month += delta;
  if (state.month < 0) { state.month = 11; state.year--; }
  if (state.month > 11) { state.month = 0; state.year++; }
  renderCalendar();
}

export function collectTriggers() {
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

// Import these lazily at runtime to avoid circular dependency
let _openForm, _openDetail;
export function setFormRefs(openForm, openDetail) {
  _openForm = openForm;
  _openDetail = openDetail;
}

