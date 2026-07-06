import { $, state, USER_ID, INTENSITY_LABELS, MONTHS, SINTMAS_MAP, getIntensityHex } from './state.js';
import { showToast, showScreen, showConfirm, api, withRetry, saveCrisis, deleteCrisis, queueOfflineKeep } from './api.js';
import { renderCalendar, collectTriggers } from './calendar.js';

export function openForm(dateStr, crisis) {
  state.editingDate = dateStr;
  $('form-date').value = dateStr;
  $('form-intensity').value = crisis ? crisis.intensidade : 5;
  $('form-time').value = crisis ? (crisis.hora_inicio || '') : '';
  $('form-end-time').value = crisis ? (crisis.hora_fim || '') : '';
  $('form-still-ongoing').checked = crisis ? !!crisis.em_andamento : false;
  $('form-end-time').disabled = $('form-still-ongoing').checked;

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

  document.querySelectorAll('[name="form-eficacia"]').forEach(r => r.checked = false);
  if (crisis && crisis.eficacia) {
    const r = document.querySelector(`[name="form-eficacia"][value="${crisis.eficacia}"]`);
    if (r) r.checked = true;
  } else {
    const r = document.querySelector('[name="form-eficacia"][value="nao_funcionou"]');
    if (r) r.checked = true;
  }

  document.querySelectorAll('#symptoms-chips .chip').forEach(c => {
    c.classList.toggle('selected', crisis && Array.isArray(crisis.sintomas) && crisis.sintomas.includes(c.dataset.value));
  });

  document.querySelectorAll('[name="form-atividade"]').forEach(r => r.checked = false);
  const atv = crisis ? (crisis.piora_atividade || 'nao') : 'nao';
  document.querySelectorAll('[name="form-atividade"]').forEach(r => { if (r.value === atv) r.checked = true; });

  $('form-hospital').checked = crisis ? !!crisis.foi_hospital : false;
  $('form-impacto').checked = crisis ? !!crisis.impacto_dia : false;
  $('form-trigger').checked = crisis ? !!crisis.teve_gatilho : false;
  $('form-trigger-desc').value = crisis ? (crisis.gatilho || '') : '';
  $('trigger-detail').classList.toggle('hidden', !$('form-trigger').checked);

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

  $('form-title').textContent = crisis ? 'Editar Crise' : 'Nova Crise';
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
  updateTicks(v);
}

function updateTicks(v) {
  const container = $('intensity-track-ticks');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i <= 10; i++) {
    const tick = document.createElement('div');
    tick.className = 'tick' + (i <= v ? ' highlight' : '');
    container.appendChild(tick);
  }
}

function initIntensitySlider() {
  const track = $('intensity-track');
  const input = $('form-intensity');
  updateTicks(parseInt(input.value, 10));
  track.addEventListener('click', e => {
    const rect = track.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const v = Math.round(x * 10);
    input.value = Math.max(0, Math.min(10, v));
    updateIntensityDisplay(input.value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function closeForm() {
  showScreen('main-screen');
  state.editingDate = null;
}

export function setupForm() {
  initIntensitySlider();

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
      if (!navigator.onLine || e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        await queueOfflineKeep('PUT', `/crises/${USER_ID}/${date}`, body);
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

export async function openDetail(dateStr) {
  const body = $('detail-body');

  try {
    const crisis = state.crises[dateStr] || await withRetry(
      () => api('GET', `/crises/${USER_ID}/${dateStr}`),
      'Erro ao carregar'
    );
    if (!crisis) { showToast('Registro não encontrado'); return; }

    const d = crisis.data || dateStr;
    const parts = d.split('-');
    $('detail-title').textContent = `${parseInt(parts[2])} de ${MONTHS[parseInt(parts[1]) - 1]} de ${parts[0]}`;

    const color = getIntensityHex(crisis.intensidade);
    const iLabel = INTENSITY_LABELS[crisis.intensidade] || crisis.intensidade;
    const sintomasHtml = (Array.isArray(crisis.sintomas) && crisis.sintomas.length) ? crisis.sintomas.map(s => SINTMAS_MAP[s] || s).join(', ') : '';
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

export function setupDetail() {
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
        await queueOfflineKeep('DELETE', `/crises/${USER_ID}/${date}`);
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
