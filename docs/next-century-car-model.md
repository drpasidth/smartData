# Next-Century Car Model — "AURORA-X1"

## Overview
The AURORA-X1 is a speculative personal mobility vehicle designed for the 22nd century. It is fully autonomous, electric-hydrogen hybrid, zero-emission, and built with adaptive nano-composite materials that change shape and color in response to environment, mood, and lighting conditions.

## Design Philosophy
- **Aerodynamic Fluidity**: No sharp edges; continuous morphing body panels reduce drag coefficient to ~0.13.
- **Living Surface**: Electrochromic + photochromic skin shifts color and opacity dynamically.
- **Interior-as-Sanctuary**: Cabin reconfigures from driver mode to lounge/sleep mode; biometric seats adjust firmness and temperature per occupant.
- **Holographic Interface**: Windshield and side panels become AR displays; no traditional dashboard.

## Dimensions & Specs
| Parameter | Value |
|---|---|
| Length | 4,950 mm |
| Width | 2,100 mm (mirrors retracted) |
| Height | 1,380 mm |
| Wheelbase | 3,100 mm |
| Seating | 2–4 (reconfigurable) |
| Powertrain | Solid-state battery + hydrogen fuel cell |
| Range | 1,200 km (combined) |
| Top Speed | 280 km/h (governed) |
| 0–100 km/h | 2.1 seconds |
| Drag Coefficient | 0.13 |
| Weight | 1,850 kg (nano-composite frame) |

## Future Color Scheme — "Chrono-Prism"

The exterior uses a tri-layer adaptive paint system:

| Layer | Name | Behavior | Appearance |
|---|---|---|---|
| Base | **Neutron Silver** | Static metallic | Brushed chrome with deep grey undertone |
| Mid | **Solar Flare Shift** | Thermochromic / electrochromic | Shifts from amber → rose → deep violet based on temperature and battery state |
| Top | **Nebula Veil** | Photochromic + iridescent | Reactive to UV and ambient light; reveals shifting galaxy-like patterns in daylight |

### Signature Palettes
1. **Dawn Protocol** — Soft coral, pale gold, pearl white. For morning city commutes.
2. **Noir Eclipse** — Matte obsidian with electric blue iridescence. Night stealth mode.
3. **Terra Bloom** — Moss green, desert sand, sky blue gradient. Eco/off-road mode.
4. **Quantum Pulse** — Neon magenta, cyan, and plasma purple. High-performance mode.

### Interior Colors
- **Seats**: Bio-leather in "Lunar Dust" (warm off-white) with embedded fiber-optic accent threads.
- **Trim**: Recycled ocean plastic in "Deep Abyss" (translucent dark blue).
- **Ambient Lighting**: Full-spectrum LED strips syncing with exterior color mode.

## Key Features
- Morphing wheel rims that close for highway efficiency and open for cooling in city traffic.
- Solar-generating roof glass (perovskite coating).
- Air-purifying exterior coating that breaks down pollutants via photocatalysis.
- AI co-pilot with emotion-sensing cabin that adjusts lighting, scent, and music.

## File Structure
- `docs/next-century-car-model.md` — this specification
- `src/car-model.js` — programmable car model (class, color system, state)
- `images/next-century-car-concept.png` — AI-generated concept visualization

## How to Use the Code Model
```js
import CarModel from './car-model';

const aurora = new CarModel({
  name: 'AURORA-X1',
  colorScheme: 'Dawn Protocol',
  mode: 'city',
});

aurora.shiftColor('Quantum Pulse');
aurora.setMode('performance');
console.log(aurora.status());
```
