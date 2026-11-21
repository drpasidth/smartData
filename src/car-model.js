/**
 * Next-Century Car Model — AURORA-X1
 *
 * A programmable representation of a 22nd-century vehicle with an adaptive,
   future-forward color scheme. Designed for use in browser or Node environments.
 */

const COLOR_SCHEMES = {
  'Dawn Protocol': {
    exterior: ['#FFB3A7', '#FFD966', '#F5F5F5'],
    interior: '#FFFFFF',
    accent: '#FFB3A7',
    mood: 'calm',
  },
  'Noir Eclipse': {
    exterior: '#1A1A1A', '#003366', '#00FFFF',
    interior: '#0A0A0A',
    accent: '#00FFFF',
    mood: 'stealth',
  },
  'Terra Bloom': {
    exterior: '#8FBC8F', '#DEB887', '#87CEEB',
    interior: '#F0FFF0',
    accent: '#8FBC8F',
    mood: 'natural',
  },
  'Quantum Pulse': {
    exterior: '#FF00FF', '#00FFFF', '#BF00FF',
    interior: '#191970',
    accent: '#FF00FF',
    mood: 'aggressive',
  },
};

const MODES = ['city', 'highway', 'off-road', 'performance', 'autonomous', 'parked'];

export default class CarModel {
  constructor({
    name = 'AURORA-X1',
    colorScheme = 'Dawn Protocol',
    mode = 'autonomous',
    rangeKm = 1200,
    batteryPercent = 100,
  } = {}) {
    this.id = crypto.randomUUID?.() ?? `car-${Date.now()}`;
    this.name = name;
    this.colorScheme = colorScheme;
    this.mode = MODES.includes(mode) ? mode : 'autonomous';
    this.rangeKm = rangeKm;
    this.batteryPercent = Math.max(0, Math.min(100, batteryPercent));
    this.speedKmh = 0;
    this.isMoving = false;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Get the current color palette object for the selected scheme.
   */
  getColors() {
    return COLOR_SCHEMES[this.colorScheme] || COLOR_SCHEMES['Dawn Protocol'];
  }

  /**
   * Get exterior color at a given index (0 = base, 1 = mid, 2 = top).
   */
  getExteriorColor(index = 0) {
    const colors = this.getColors().exterior;
    if (Array.isArray(colors)) {
      return colors[index] ?? colors[0];
    }
    return colors;
  }

  /**
   * Shift the car to a new future color scheme.
   * @param {string} scheme - One of the COLOR_SCHEMES keys.
   */
  shiftColor(scheme) {
    if (!(scheme in COLOR_SCHEMES)) {
      throw new Error(`Unknown color scheme: ${scheme}`);
    }
    this.colorScheme = scheme;
    return this.getColors();
  }

  /**
   * Change driving mode.
   */
  setMode(mode) {
    if (!MODES.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    this.mode = mode;
    return this.mode;
  }

  /**
   * Accelerate to a target speed.
   */
  setSpeed(kmh) {
    this.speedKmh = Math.max(0, Math.min(280, kmh));
    this.isMoving = this.speedKmh > 0;
    return this.speedKmh;
  }

  /**
   * Consume battery based on distance driven (km).
   */
  drive(distanceKm) {
    const consumptionPerKm = 0.08; // % of battery per km
    const used = distanceKm * consumptionPerKm;
    this.batteryPercent = Math.max(0, this.batteryPercent - used);
    this.rangeKm = Math.max(0, (this.batteryPercent / 100) * 1200);
    return {
      distanceKm,
      batteryPercent: this.batteryPercent,
      rangeKm: this.rangeKm,
    };
  }

  /**
   * Recharge battery to a target percentage.
   */
  charge(targetPercent = 100) {
    this.batteryPercent = Math.min(100, Math.max(this.batteryPercent, targetPercent));
    this.rangeKm = (this.batteryPercent / 100) * 1200;
    return this.batteryPercent;
  }

  /**
   * Return a status snapshot useful for dashboards or UI.
   */
  status() {
    return {
      id: this.id,
      name: this.name,
      colorScheme: this.colorScheme,
      colors: this.getColors(),
      mode: this.mode,
      speedKmh: this.speedKmh,
      isMoving: this.isMoving,
      batteryPercent: Math.round(this.batteryPercent * 10) / 10,
      rangeKm: Math.round(this.rangeKm),
      createdAt: this.createdAt,
    };
  }
}
