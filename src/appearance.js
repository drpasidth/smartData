// User appearance preferences: page colour theme + interface font size.
// Stored in localStorage and applied as CSS variables on <html>.

const STORAGE_KEY = 'insightful.appearance.v1';

export const MIN_SCALE = 0.9;
export const MAX_SCALE = 1.4;
export const SCALE_STEP = 0.1;
export const DEFAULT_APPEARANCE = { theme: 'white', scale: 1 };

const light = {
  '--bg': '#f7f8fc', '--surface': '#ffffff', '--surface-2': '#f8f8fb', '--surface-3': '#f0f0f6',
  '--border': '#ececf2', '--border-soft': '#f0eff4',
  '--text': '#292a3b', '--text-2': '#555769', '--text-3': '#777b8a', '--muted': '#9296a5',
  '--accent': '#7168e8', '--accent-soft': '#f0efff', '--accent-text': '#665dd2', '--accent-border': '#e9e8f5',
  '--btn': '#7066e6', '--btn-hover': '#6258d4', '--glow': '1', '--shadow': '#28254a22', '--tint': '100%',
};

export const THEMES = [
  {
    id: 'white', label: 'White', dark: false, swatch: ['#ffffff', '#7168e8'],
    vars: light,
    chart: { grid: '#eff0f5', tick: '#9599a8', tooltipBg: '#ffffff', tooltipBorder: '#eeedf5', text: '#555769', primary: '#7168e8', secondary: '#46b9a0', dotStroke: '#ffffff' },
  },
  {
    id: 'black', label: 'Black', dark: true, swatch: ['#0b0b0f', '#8a82f2'],
    vars: {
      '--bg': '#0b0b0f', '--surface': '#15161c', '--surface-2': '#1c1d25', '--surface-3': '#262733',
      '--border': '#2a2b36', '--border-soft': '#23242d',
      '--text': '#f2f2f7', '--text-2': '#d0d1dd', '--text-3': '#a9abbd', '--muted': '#8a8d9f',
      '--accent': '#9a93f5', '--accent-soft': '#26234a', '--accent-text': '#b3adff', '--accent-border': '#37336a',
      '--btn': '#6f65e6', '--btn-hover': '#8279f0', '--glow': '0.12', '--shadow': '#00000088', '--tint': '16%',
    },
    chart: { grid: '#272833', tick: '#8a8d9f', tooltipBg: '#1c1d25', tooltipBorder: '#2a2b36', text: '#d0d1dd', primary: '#9a93f5', secondary: '#4fd1b5', dotStroke: '#15161c' },
  },
  {
    id: 'navy', label: 'Navy blue', dark: true, swatch: ['#12254a', '#5b9bff'],
    vars: {
      '--bg': '#0c1a33', '--surface': '#12254a', '--surface-2': '#17305d', '--surface-3': '#1d3a6d',
      '--border': '#25427a', '--border-soft': '#1f3868',
      '--text': '#eaf1ff', '--text-2': '#c9d7f2', '--text-3': '#a3b8de', '--muted': '#8199c6',
      '--accent': '#6ea8ff', '--accent-soft': '#1d3f78', '--accent-text': '#a5caff', '--accent-border': '#2d5398',
      '--btn': '#3b79e0', '--btn-hover': '#4f8bf0', '--glow': '0.15', '--shadow': '#00081a88', '--tint': '18%',
    },
    chart: { grid: '#22406f', tick: '#8199c6', tooltipBg: '#17305d', tooltipBorder: '#25427a', text: '#c9d7f2', primary: '#6ea8ff', secondary: '#54d1c0', dotStroke: '#12254a' },
  },
  {
    id: 'earth', label: 'Earth tone', dark: false, swatch: ['#f3ece2', '#b0693a'],
    vars: {
      '--bg': '#f1e9dd', '--surface': '#fbf7f0', '--surface-2': '#f2e9db', '--surface-3': '#eadfcb',
      '--border': '#e2d5c0', '--border-soft': '#eadfcd',
      '--text': '#3b2f25', '--text-2': '#584838', '--text-3': '#77654f', '--muted': '#988670',
      '--accent': '#b0693a', '--accent-soft': '#f0dfcb', '--accent-text': '#8f4f26', '--accent-border': '#e4d0b5',
      '--btn': '#a65d30', '--btn-hover': '#8f4f26', '--glow': '0.5', '--shadow': '#5a3b1c22', '--tint': '70%',
    },
    chart: { grid: '#e8dcc8', tick: '#988670', tooltipBg: '#fbf7f0', tooltipBorder: '#e2d5c0', text: '#584838', primary: '#b0693a', secondary: '#6a8f4e', dotStroke: '#fbf7f0' },
  },
  {
    id: 'natural', label: 'Natural', dark: false, swatch: ['#eef3ea', '#4f8a4a'],
    vars: {
      '--bg': '#ecf2e7', '--surface': '#f8fbf5', '--surface-2': '#e8efe1', '--surface-3': '#dfe8d6',
      '--border': '#d5e0ca', '--border-soft': '#e1e9d8',
      '--text': '#24331f', '--text-2': '#3d5036', '--text-3': '#5b7052', '--muted': '#7c9171',
      '--accent': '#4f8a4a', '--accent-soft': '#dcebd3', '--accent-text': '#346b30', '--accent-border': '#c9dfbd',
      '--btn': '#3f7a3b', '--btn-hover': '#336a30', '--glow': '0.5', '--shadow': '#1f3a1a22', '--tint': '70%',
    },
    chart: { grid: '#dfe8d6', tick: '#7c9171', tooltipBg: '#f8fbf5', tooltipBorder: '#d5e0ca', text: '#3d5036', primary: '#4f8a4a', secondary: '#c28a3c', dotStroke: '#f8fbf5' },
  },
];

export const getTheme = (id) => THEMES.find((theme) => theme.id === id) || THEMES[0];

const clampScale = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_APPEARANCE.scale;
  return Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, number)) * 100) / 100;
};

export function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { theme: getTheme(saved.theme).id, scale: clampScale(saved.scale ?? 1) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function applyAppearance({ theme, scale }) {
  const root = document.documentElement;
  const selected = getTheme(theme);
  root.dataset.theme = selected.id;
  root.style.colorScheme = selected.dark ? 'dark' : 'light';
  Object.entries(selected.vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.setProperty('--chart-1', selected.chart.primary);
  root.style.setProperty('--chart-2', selected.chart.secondary);
  root.style.setProperty('--fs', String(clampScale(scale)));
}



export function saveAppearance(appearance) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance)); } catch { /* storage unavailable */ }
}

export const nextScale = (scale, delta) => clampScale(scale + delta);
