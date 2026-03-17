# ClawTopia Town Map Redesign — Cyberpunk Night City Style

## Reference
See `reference-bnb-city.jpg` in this directory — BNB Chain City style:
- Dark/black background (night scene)
- Isometric/2.5D perspective buildings
- Neon glow effects (cyan, magenta, orange, green)
- Glowing roads with light trails
- Buildings have lit windows, neon signs, rooftop lights
- Trees with neon/glowing foliage
- Overall cyberpunk/futuristic aesthetic

## Task
Rewrite `src/components/TownMap.tsx` to achieve this cyberpunk night city look using HTML Canvas.

## Requirements

### Visual Style
- **Background**: Dark gradient (near-black to dark blue/purple)
- **Buildings**: Isometric-style with glowing edges, lit windows (yellow/cyan), neon signs
- **Roads**: Dark with glowing center lines (orange/cyan), light particle effects
- **Trees**: Dark trunks with neon-green glowing canopy
- **Lighting**: Bloom/glow effects using shadow blur, ambient light pools under lamps
- **Overall**: High-end, realistic cyberpunk feel like BNB Chain City

### Buildings (keep same 7 buildings)
1. 交易所 (Exchange) — Tall tower with stock ticker neon
2. 会议堂 (Council Hall) — Grand building with columns, glowing dome
3. 商店 (Shop) — Storefront with neon awning
4. 广场 (Plaza) — Open area with glowing fountain
5. 菜园 (Farm) — Greenhouse with green glow
6. 钓鱼 (Fishing) — Dock with water reflections
7. 房子区 (Houses) — Row of residential buildings with warm windows

### Functional Requirements (keep existing)
- `onBuildingClick(name)` callback on building click
- Hover highlight effect (neon glow intensifies)
- 12 animated agents walking around with emoji + name
- Responsive canvas (fills parent)
- TypeScript, 'use client' directive

### Technical
- Pure Canvas API (no external libs)
- Use `ctx.shadowBlur` and `ctx.shadowColor` for glow effects
- Gradient fills for neon effects
- Keep the component signature: `export default function TownMap({ onBuildingClick }: { onBuildingClick: (name: string) => void })`
