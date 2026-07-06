import { $, state } from './state.js';
import { showScreen, fetchMonth } from './api.js';

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

export async function openStats() {
  showScreen('stats-screen');
  $('stats-loading').style.display = 'block';
  $('stats-content').classList.add('hidden');

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

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

    const trigFreq = {};
    allCur.forEach(c => { if (c.teve_gatilho && c.gatilho) { const t = c.gatilho.trim().toLowerCase(); if (t) trigFreq[t] = (trigFreq[t] || 0) + 1; } });
    const topTrigger = Object.entries(trigFreq).sort((a, b) => b[1] - a[1])[0];

    const dist = { '1-3': 0, '4-6': 0, '7-8': 0, '9-10': 0 };
    allCur.forEach(c => {
      if (c.intensidade <= 3) dist['1-3']++;
      else if (c.intensidade <= 6) dist['4-6']++;
      else if (c.intensidade <= 8) dist['7-8']++;
      else dist['9-10']++;
    });

    const meds = collectMedicineUsage(30);

    $('stats-loading').style.display = 'none';
    $('stats-content').classList.remove('hidden');

    const cards = $('stats-cards');
    cards.innerHTML = `
      <div class="stat-card"><div class="stat-card-value">${curCount}</div><div class="stat-card-label">Crises este mês</div></div>
      <div class="stat-card"><div class="stat-card-value">${prevCount}</div><div class="stat-card-label">Mês anterior</div></div>
      <div class="stat-card"><div class="stat-card-value">${avgIntensity ? avgIntensity.toFixed(1) : '—'}</div><div class="stat-card-label">Intensidade média</div></div>
      <div class="stat-card"><div class="stat-card-value">${topTrigger ? topTrigger[1] : '—'}</div><div class="stat-card-label">${topTrigger ? topTrigger[0].charAt(0).toUpperCase() + topTrigger[0].slice(1) : 'Nenhum gatilho'}</div></div>
      <div class="stat-card full" style="background:transparent;padding:0"></div>`;

    const barChart1 = $('bar-chart-intensity');
    const maxDist = Math.max(...Object.values(dist), 1);
    const distColors = { '1-3': 'var(--sev-2)', '4-6': 'var(--sev-3)', '7-8': 'var(--sev-4)', '9-10': 'var(--sev-5)' };
    barChart1.innerHTML = Object.entries(dist).map(([k, v]) =>
      `<div class="bar-chart-col"><div class="bar-chart-bar" style="height:${(v / maxDist) * 100}%;background:${distColors[k]}"></div><div class="bar-chart-label">${k}<br>${v}</div></div>`
    ).join('');

    const barChart2 = $('bar-chart-compare');
    const maxCmp = Math.max(curCount, prevCount, 1);
    barChart2.innerHTML = `
      <div class="bar-chart-col"><div class="bar-chart-bar" style="height:${(curCount / maxCmp) * 100}%;background:var(--primary)"></div><div class="bar-chart-label">Este mês<br>${curCount}</div></div>
      <div class="bar-chart-col"><div class="bar-chart-bar" style="height:${(prevCount / maxCmp) * 100}%;background:var(--text3)"></div><div class="bar-chart-label">Mês ant.<br>${prevCount}</div></div>`;

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
    $('stats-cards').innerHTML = '<div class="stat-card full"><div class="stat-card-value">—</div><div class="stat-card-label">Erro ao carregar dados</div></div>';
  }
}
