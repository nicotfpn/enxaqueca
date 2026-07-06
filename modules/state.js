export const API = '/api';
export const USER_ID = 'default';
export const OFFLINE_DB = 'de_offline';
export const OFFLINE_STORE = 'pending';

export const INTENSITY_LABELS = [
  'Sem dor', 'Mínima', 'Muito leve', 'Leve',
  'Leve-Moderada', 'Moderada', 'Moderada-Forte',
  'Forte', 'Muito forte', 'Intensa', 'Insuportável'
];

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const INTENSITY_HEX = [
  null, '#4F7259', '#5C8267', '#84AC82',
  '#D3B15E', '#D0A050', '#D0813F',
  '#C9713F', '#BD5F4A',
  '#B24F55', '#8F3E48'
];

export const SINTMAS_MAP = {
  nausea: 'Náusea', vomito: 'Vômito', fotofobia: 'Sensib. à luz',
  fonofobia: 'Sensib. ao som', aura: 'Aura', tontura: 'Tontura'
};

export const state = {
  year: 0, month: 0, crises: {},
  selectedDate: null, editingDate: null,
  extraCrises: {}
};

export const sessionId = crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));

export const $ = id => document.getElementById(id);

export const pad2 = n => String(n).padStart(2, '0');

export const fmtDate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

export const apiURL = (path, qs) => API + path + (qs ? '?' + qs : '');

export const getIntensityHex = v => INTENSITY_HEX[v] || null;
