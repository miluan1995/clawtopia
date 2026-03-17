'use client'
import { useRef, useEffect } from 'react'

interface Building {
  name: string; x: number; y: number; w: number; h: number
  roofColor: string; wallColor: string; doorColor: string; type: string
}

const BUILDINGS: Building[] = [
  { name: '交易所', x: 60, y: 100, w: 110, h: 90, roofColor: '#7c5cbf', wallColor: '#d5c8f2', doorColor: '#5a3e9e', type: 'tall' },
  { name: '会议堂', x: 240, y: 80, w: 140, h: 110, roofColor: '#c4956a', wallColor: '#e8d5b7', doorColor: '#8b6914', type: 'grand' },
  { name: '商店', x: 460, y: 100, w: 100, h: 85, roofColor: '#d4764e', wallColor: '#f2d5b8', doorColor: '#a0522d', type: 'shop' },
  { name: '广场', x: 120, y: 310, w: 150, h: 80, roofColor: '#5a9e5a', wallColor: '#d4e8c2', doorColor: '#3d7a3d', type: 'park' },
  { name: '菜园', x: 400, y: 300, w: 130, h: 90, roofColor: '#6aaa3a', wallColor: '#c8e6a0', doorColor: '#4a8a2a', type: 'farm' },
  { name: '钓鱼', x: 50, y: 440, w: 110, h: 75, roofColor: '#4a90c4', wallColor: '#b3d9f2', doorColor: '#2a6a9e', type: 'dock' },
  { name: '房子区', x: 300, y: 430, w: 160, h: 85, roofColor: '#c45a5a', wallColor: '#f2c8c8', doorColor: '#a03030', type: 'houses' },
]

interface Agent { id: string; x: number; y: number; dx: number; dy: number; color: string; emoji: string; name: string }
const EMOJIS = ['🐱','🐶','🐻','🐰','🦊','🐼','🐨','🐸','🐵','🦁','🐧','🐮']
const NAMES = ['Fox','Bear','Cat','Bunny','Panda','Frog','Koala','Lion','Penguin','Cow','Dog','Monkey']
const COLORS = ['#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#6c5ce7','#fd79a8','#00b894','#e17055','#a29bfe','#fab1a0','#81ecec','#ffeaa7']

function mkAgents(n: number): Agent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `a${i}`, x: 80 + Math.random() * 500, y: 80 + Math.random() * 420,
    dx: (Math.random() - 0.5) * 0.8, dy: (Math.random() - 0.5) * 0.8,
    color: COLORS[i % COLORS.length], emoji: EMOJIS[i % EMOJIS.length], name: NAMES[i % NAMES.length],
  }))
}

export default function TownMap({ onBuildingClick }: { onBuildingClick: (name: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const agents = useRef(mkAgents(12))
  const hover = useRef<string | null>(null)

  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    let raf: number, W = 0, H = 0

    const resize = () => { W = c.width = c.parentElement!.clientWidth; H = c.height = c.parentElement!.clientHeight }
    resize(); window.addEventListener('resize', resize)

    const sx = () => W / 650, sy = () => H / 580

    // draw helpers
    const drawTree = (x: number, y: number, s: number) => {
      ctx.fillStyle = '#6b4226'; ctx.fillRect(x - 3 * s, y, 6 * s, 14 * s)
      ctx.fillStyle = '#2d8a4e'; ctx.beginPath(); ctx.arc(x, y - 4 * s, 14 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#3da85e'; ctx.beginPath(); ctx.arc(x - 5 * s, y - 2 * s, 10 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#48c76e'; ctx.beginPath(); ctx.arc(x + 4 * s, y - 6 * s, 8 * s, 0, Math.PI * 2); ctx.fill()
    }
    const drawLamp = (x: number, y: number, s: number) => {
      ctx.fillStyle = '#555'; ctx.fillRect(x - 1.5 * s, y - 20 * s, 3 * s, 22 * s)
      ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(x, y - 22 * s, 5 * s, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,215,0,0.15)'; ctx.beginPath(); ctx.arc(x, y - 22 * s, 18 * s, 0, Math.PI * 2); ctx.fill()
    }
    const drawRoof = (x: number, y: number, w: number, h: number, color: string, type: string) => {
      ctx.fillStyle = color
      if (type === 'grand') {
        // triangular grand roof with columns
        ctx.beginPath(); ctx.moveTo(x - 10, y + h * 0.35); ctx.lineTo(x + w / 2, y - 10); ctx.lineTo(x + w + 10, y + h * 0.35); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#fff8'; for (let i = 0; i < 3; i++) { ctx.fillRect(x + 15 + i * (w - 20) / 2, y + h * 0.35, 6, h * 0.55) }
      } else if (type === 'shop') {
        // awning
        ctx.beginPath(); ctx.moveTo(x - 8, y + h * 0.3); ctx.lineTo(x + w + 8, y + h * 0.3)
        ctx.lineTo(x + w + 4, y + h * 0.45); ctx.lineTo(x - 4, y + h * 0.45); ctx.closePath(); ctx.fill()
        // stripes
        ctx.fillStyle = '#fff6'
        for (let i = 0; i < 4; i++) ctx.fillRect(x - 4 + i * (w + 8) / 4, y + h * 0.3, (w + 8) / 8, h * 0.15)
      } else if (type === 'park') {
        // gazebo / open roof
        ctx.beginPath(); ctx.moveTo(x - 5, y + h * 0.25); ctx.lineTo(x + w / 2, y - 8); ctx.lineTo(x + w + 5, y + h * 0.25); ctx.closePath(); ctx.fill()
      } else if (type === 'farm') {
        // barn roof
        ctx.beginPath(); ctx.moveTo(x - 5, y + h * 0.3); ctx.quadraticCurveTo(x + w / 2, y - 15, x + w + 5, y + h * 0.3); ctx.closePath(); ctx.fill()
      } else if (type === 'dock') {
        // flat with wave
        ctx.fillRect(x - 5, y + h * 0.2, w + 10, h * 0.12)
      } else if (type === 'houses') {
        // multiple small roofs
        const n = 3, sw = w / n
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i % 2 === 0 ? color : '#d47a7a'
          ctx.beginPath(); ctx.moveTo(x + i * sw, y + h * 0.3); ctx.lineTo(x + i * sw + sw / 2, y); ctx.lineTo(x + (i + 1) * sw, y + h * 0.3); ctx.closePath(); ctx.fill()
        }
      } else {
        // default pitched roof
        ctx.beginPath(); ctx.moveTo(x - 8, y + h * 0.35); ctx.lineTo(x + w / 2, y - 5); ctx.lineTo(x + w + 8, y + h * 0.35); ctx.closePath(); ctx.fill()
        // chimney
        ctx.fillStyle = '#8b6914'; ctx.fillRect(x + w * 0.7, y - 2, 10, h * 0.2)
        ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(x + w * 0.7 + 5, y - 4, 6, 0, Math.PI * 2); ctx.fill()
      }
    }
    const drawWindows = (x: number, y: number, w: number, h: number, type: string) => {
      const wy = y + h * 0.42, wh = h * 0.18, ww = w * 0.14
      ctx.fillStyle = '#87ceeb'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      if (type === 'park' || type === 'dock') return
      if (type === 'houses') {
        for (let i = 0; i < 5; i++) {
          const wx = x + 8 + i * (w - 16) / 5
          ctx.fillRect(wx, wy, ww, wh); ctx.strokeRect(wx, wy, ww, wh)
          ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke()
        }
        return
      }
      const cols = type === 'grand' ? 4 : 2
      for (let i = 0; i < cols; i++) {
        const wx = x + w * 0.15 + i * (w * 0.7 / cols)
        ctx.fillRect(wx, wy, ww, wh); ctx.strokeRect(wx, wy, ww, wh)
        ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke()
      }
    }
    const drawDoor = (x: number, y: number, w: number, h: number, color: string, type: string) => {
      if (type === 'park' || type === 'dock') return
      const dw = w * 0.16, dh = h * 0.28, dx = x + w / 2 - dw / 2, dy = y + h - dh - 2
      ctx.fillStyle = color
      ctx.beginPath(); ctx.moveTo(dx, dy + dh); ctx.lineTo(dx, dy + 4); ctx.arc(dx + dw / 2, dy + 4, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw, dy + dh); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(dx + dw * 0.7, dy + dh * 0.55, 2, 0, Math.PI * 2); ctx.fill()
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const kx = sx(), ky = sy()

      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.3)
      sky.addColorStop(0, '#87ceeb'); sky.addColorStop(1, '#c8e6a0')
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

      // grass
      ctx.fillStyle = '#7bc67e'; ctx.fillRect(0, H * 0.15, W, H)

      // cobblestone roads
      ctx.fillStyle = '#b8a88a'
      ctx.fillRect(W * 0.47, 0, W * 0.08, H) // vertical
      ctx.fillRect(0, H * 0.48, W, H * 0.07) // horizontal
      // road lines
      ctx.strokeStyle = '#d4c4a0'; ctx.lineWidth = 1; ctx.setLineDash([6, 8])
      ctx.beginPath(); ctx.moveTo(W * 0.51, 0); ctx.lineTo(W * 0.51, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, H * 0.515); ctx.lineTo(W, H * 0.515); ctx.stroke()
      ctx.setLineDash([])
      // cobblestones
      ctx.fillStyle = '#a0907a'
      for (let i = 0; i < 40; i++) {
        const cx = W * 0.47 + Math.random() * W * 0.08, cy = Math.random() * H
        ctx.beginPath(); ctx.ellipse(cx, cy, 3, 2, 0, 0, Math.PI * 2); ctx.fill()
      }
      for (let i = 0; i < 40; i++) {
        const cx = Math.random() * W, cy = H * 0.48 + Math.random() * H * 0.07
        ctx.beginPath(); ctx.ellipse(cx, cy, 3, 2, 0, 0, Math.PI * 2); ctx.fill()
      }

      // trees
      const trees = [[20, 200], [600, 150], [590, 380], [30, 350], [320, 200], [550, 500], [15, 530], [620, 530]]
      for (const [tx, ty] of trees) drawTree(tx * kx, ty * ky, Math.min(kx, ky))

      // lamps
      const lamps = [[190, 260], [420, 260], [190, 520], [420, 520]]
      for (const [lx, ly] of lamps) drawLamp(lx * kx, ly * ky, Math.min(kx, ky))

      // buildings
      for (const b of BUILDINGS) {
        const bx = b.x * kx, by = b.y * ky, bw = b.w * kx, bh = b.h * ky
        const isHover = hover.current === b.name

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)'
        ctx.beginPath(); ctx.roundRect(bx + 4, by + 4, bw, bh, 6); ctx.fill()

        // wall
        ctx.fillStyle = isHover ? '#fff' : b.wallColor
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill()
        ctx.strokeStyle = isHover ? '#ff8c42' : '#8b735580'
        ctx.lineWidth = isHover ? 3 : 1.5
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.stroke()

        // roof
        drawRoof(bx, by, bw, bh, b.roofColor, b.type)
        // windows
        drawWindows(bx, by, bw, bh, b.type)
        // door
        drawDoor(bx, by, bw, bh, b.doorColor, b.type)

        // sign
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        const tw = ctx.measureText(b.name).width
        const signW = tw + 16, signH = 20
        const signX = bx + bw / 2 - signW / 2, signY = by + bh + 4
        ctx.beginPath(); ctx.roundRect(signX, signY, signW, signH, 6); ctx.fill()
        ctx.strokeStyle = '#8b7355'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.roundRect(signX, signY, signW, signH, 6); ctx.stroke()
        ctx.font = `bold ${Math.max(11, 12 * Math.min(kx, ky))}px "Comic Sans MS", cursive`
        ctx.textAlign = 'center'; ctx.fillStyle = '#3d2c1e'
        ctx.fillText(b.name, bx + bw / 2, signY + 14)

        // special decorations
        if (b.type === 'park') {
          // fountain
          ctx.fillStyle = '#6bb5e0'; ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh * 0.6, 8 * Math.min(kx, ky), 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#87ceeb'; ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh * 0.6, 4 * Math.min(kx, ky), 0, Math.PI * 2); ctx.fill()
        }
        if (b.type === 'farm') {
          // crop rows
          ctx.fillStyle = '#4a8a2a'
          for (let r = 0; r < 3; r++) {
            const ry = by + bh * 0.65 + r * 8 * ky / 580
            for (let c = 0; c < 5; c++) ctx.fillRect(bx + 10 + c * bw / 5, ry, bw / 7, 3)
          }
        }
        if (b.type === 'dock') {
          // water
          ctx.fillStyle = 'rgba(107,181,224,0.3)'
          ctx.fillRect(bx - 10, by + bh - 10, bw + 20, 14)
          ctx.strokeStyle = '#6bb5e0'; ctx.lineWidth = 1
          for (let w = 0; w < 3; w++) {
            ctx.beginPath()
            ctx.moveTo(bx - 10, by + bh - 4 + w * 4)
            for (let p = 0; p < bw + 20; p += 10) ctx.quadraticCurveTo(bx - 10 + p + 5, by + bh - 7 + w * 4, bx - 10 + p + 10, by + bh - 4 + w * 4)
            ctx.stroke()
          }
        }
      }

      // agents
      for (const a of agents.current) {
        a.x += a.dx; a.y += a.dy
        if (a.x < 20 || a.x > W - 20) a.dx *= -1
        if (a.y < 20 || a.y > H - 20) a.dy *= -1
        if (Math.random() < 0.008) { a.dx = (Math.random() - 0.5) * 0.8; a.dy = (Math.random() - 0.5) * 0.8 }

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + 12, 10, 4, 0, 0, Math.PI * 2); ctx.fill()
        // body
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText(a.emoji, a.x, a.y + 6)
        // name tag
        ctx.font = '9px sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillText(a.name, a.x, a.y - 10)
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    // hover detection
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
      const kx2 = sx(), ky2 = sy()
      let found: string | null = null
      for (const b of BUILDINGS) {
        if (mx >= b.x * kx2 && mx <= (b.x + b.w) * kx2 && my >= b.y * ky2 && my <= (b.y + b.h) * ky2) { found = b.name; break }
      }
      hover.current = found
      c.style.cursor = found ? 'pointer' : 'default'
    }
    const onClick = (e: MouseEvent) => {
      const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
      const kx2 = sx(), ky2 = sy()
      for (const b of BUILDINGS) {
        if (mx >= b.x * kx2 && mx <= (b.x + b.w) * kx2 && my >= b.y * ky2 && my <= (b.y + b.h) * ky2) { onBuildingClick(b.name); return }
      }
    }
    c.addEventListener('mousemove', onMove)
    c.addEventListener('click', onClick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); c.removeEventListener('mousemove', onMove); c.removeEventListener('click', onClick) }
  }, [onBuildingClick])

  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}
