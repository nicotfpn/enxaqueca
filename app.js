import { $, state, fmtDate } from './modules/state.js';
import { showToast, showScreen, flushOfflineQueue } from './modules/api.js';
import { renderCalendar, navigateMonth, setFormRefs } from './modules/calendar.js';
import { openForm, openDetail, setupForm, setupDetail } from './modules/form.js';
import { openStats } from './modules/stats.js';

setFormRefs(openForm, openDetail);

setupForm();
setupDetail();

$('fab-today').addEventListener('click', () => {
  const today = new Date();
  const dateStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
  state.year = today.getFullYear();
  state.month = today.getMonth();

  if (state.crises[dateStr]) {
    openDetail(dateStr);
  } else {
    renderCalendar();
    openForm(dateStr, null);
  }
});

$('prev-month').addEventListener('click', () => navigateMonth(-1));
$('next-month').addEventListener('click', () => navigateMonth(1));
$('btn-stats').addEventListener('click', openStats);
$('stats-close').addEventListener('click', () => showScreen('main-screen'));

async function initApp() {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  showScreen('main-screen');
  await renderCalendar();
  flushOfflineQueue().catch(() => {});
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

window.addEventListener('online', () => {
  showToast('Conexão restaurada', 'success');
  flushOfflineQueue().catch(() => {});
});

initApp();
