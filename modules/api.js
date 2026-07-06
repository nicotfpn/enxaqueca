import { $, API, USER_ID, OFFLINE_DB, OFFLINE_STORE, apiURL, sessionId } from './state.js';

let toastTimer = null;
export function showToast(msg, type) {
  const el = $('toast');
  el.textContent = msg; el.className = 'toast';
  if (type) el.classList.add(type);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

let errorResolve = null;
export function showError(msg) {
  const banner = $('error-banner');
  $('error-msg').textContent = msg;
  banner.classList.remove('hidden');
  banner.classList.add('show');
  return new Promise(resolve => { errorResolve = resolve; });
}
export function hideError() {
  const banner = $('error-banner');
  banner.classList.remove('show');
  banner.classList.add('hidden');
}
$('error-retry').addEventListener('click', () => {
  hideError();
  if (errorResolve) { errorResolve(); errorResolve = null; }
});

export function showConfirm(msg) {
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

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

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

export async function api(method, path, body) {
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

export async function withRetry(fn, label) {
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

export async function fetchMonth(year, month) {
  const qs = `year=${year}&month=${month + 1}`;
  return api('GET', `/crises/${USER_ID}/month?${qs}`);
}

export async function saveCrisis(date, data) {
  data._idempotent = sessionId;
  return api('PUT', `/crises/${USER_ID}/${date}`, data);
}

export async function deleteCrisis(date) {
  return api('DELETE', `/crises/${USER_ID}/${date}`);
}

export async function queueOfflineKeep(method, path, body) {
  return queueOffline(method, path, body);
}

export { flushOfflineQueue, openDB };
