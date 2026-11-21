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
  {
    id: 'sunset', label: 'Sunset', dark: false, swatch: ['#fff1e6', '#ff5e3a'],
    vars: {
      '--bg': '#fff1e6', '--surface': '#fffaf6', '--surface-2': '#ffe9d9', '--surface-3': '#ffdcc4',
      '--border': '#ffd3b6', '--border-soft': '#ffe3d0',
      '--text': '#3d1a0e', '--text-2': '#6b3320', '--text-3': '#8f4f38', '--muted': '#b07a62',
      '--accent': '#ff5e3a', '--accent-soft': '#ffe0d3', '--accent-text': '#e0401c', '--accent-border': '#ffc6ad',
      '--btn': '#f2452a', '--btn-hover': '#d93a20', '--glow': '0.8', '--shadow': '#7a2a0f22', '--tint': '90%',
    },
    chart: { grid: '#ffd9c4', tick: '#b07a62', tooltipBg: '#fffaf6', tooltipBorder: '#ffd3b6', text: '#6b3320', primary: '#ff5e3a', secondary: '#ffb000', dotStroke: '#fffaf6' },
  },
  {
    id: 'ocean-neon', label: 'Ocean neon', dark: true, swatch: ['#061826', '#22d3ee'],
    vars: {
      '--bg': '#061826', '--surface': '#0b2436', '--surface-2': '#10304a', '--surface-3': '#16405f',
      '--border': '#1d5274', '--border-soft': '#153d5a',
      '--text': '#e6fbff', '--text-2': '#b9eef7', '--text-3': '#8fd9e8', '--muted': '#6bbfd2',
      '--accent': '#22d3ee', '--accent-soft': '#0b3d4d', '--accent-text': '#67e8f9', '--accent-border': '#14607a',
      '--btn': '#06b6d4', '--btn-hover': '#22c7e6', '--glow': '0.35', '--shadow': '#00101f88', '--tint': '22%',
    },
    chart: { grid: '#17405a', tick: '#6bbfd2', tooltipBg: '#10304a', tooltipBorder: '#1d5274', text: '#b9eef7', primary: '#22d3ee', secondary: '#a3e635', dotStroke: '#0b2436' },
  },
  {
    id: 'berry-pop', label: 'Berry pop', dark: false, swatch: ['#fdf0fa', '#e11d8a'],
    vars: {
      '--bg': '#fdf0fa', '--surface': '#fffafd', '--surface-2': '#fbe4f3', '--surface-3': '#f6d2ea',
      '--border': '#f3c2e2', '--border-soft': '#f9dcef',
      '--text': '#3a0f2b', '--text-2': '#5e1d46', '--text-3': '#82366a', '--muted': '#a8639a',
      '--accent': '#e11d8a', '--accent-soft': '#fbd6ec', '--accent-text': '#b8126f', '--accent-border': '#f5b3dc',
      '--btn': '#d01b7d', '--btn-hover': '#b0106a', '--glow': '0.8', '--shadow': '#5a0a3a22', '--tint': '90%',
    },
    chart: { grid: '#f6d2ea', tick: '#a8639a', tooltipBg: '#fffafd', tooltipBorder: '#f3c2e2', text: '#5e1d46', primary: '#e11d8a', secondary: '#0ea5e9', dotStroke: '#fffafd' },
  },
  {
    id: 'lime-jungle', label: 'Lime jungle', dark: false, swatch: ['#f1fbdf', '#65a30d'],
    vars: {
      '--bg': '#f1fbdf', '--surface': '#fbfff4', '--surface-2': '#e6f7c8', '--surface-3': '#d9f1b0',
      '--border': '#c8e89a', '--border-soft': '#dcf2bd',
      '--text': '#1d3006', '--text-2': '#33500e', '--text-3': '#4f7418', '--muted': '#71963a',
      '--accent': '#65a30d', '--accent-soft': '#d9f5a6', '--accent-text': '#4a7d08', '--accent-border': '#bde680',
      '--btn': '#5a9e0c', '--btn-hover': '#4a8607', '--glow': '0.8', '--shadow': '#1d300622', '--tint': '90%',
    },
    chart: { grid: '#d4eeaa', tick: '#71963a', tooltipBg: '#fbfff4', tooltipBorder: '#c8e89a', text: '#33500e', primary: '#65a30d', secondary: '#f97316', dotStroke: '#fbfff4' },
  },
  {
    id: 'cyber-purple', label: 'Cyber purple', dark: true, swatch: ['#14061f', '#d946ef'],
    vars: {
      '--bg': '#14061f', '--surface': '#1e0b2e', '--surface-2': '#27103d', '--surface-3': '#321650',
      '--border': '#4a1d72', '--border-soft': '#361457',
      '--text': '#fbeeff', '--text-2': '#eccfff', '--text-3': '#d9a8f5', '--muted': '#b07fd6',
      '--accent': '#e879f9', '--accent-soft': '#3d1152', '--accent-text': '#f0abfc', '--accent-border': '#5e1f8a',
      '--btn': '#c026d3', '--btn-hover': '#d946ef', '--glow': '0.3', '--shadow': '#0a000f88', '--tint': '20%',
    },
    chart: { grid: '#3a1560', tick: '#b07fd6', tooltipBg: '#27103d', tooltipBorder: '#4a1d72', text: '#eccfff', primary: '#e879f9', secondary: '#facc15', dotStroke: '#1e0b2e' },
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
