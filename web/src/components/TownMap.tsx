'use client'
import { useRef, useEffect, useCallback } from 'react'

interface Building {
  name: string; x: number; y: number; w: number; h: number
  color: string; glow: string; icon: string; floors: number
}

const BUILDINGS: Building[] = [
  { name: '交易所', x: 80, y: 60, w: 160, h: 200, color: '#0a1628', glow: '#00f0ff', icon: '📈', floors: 6 },
  { name: '会议堂', x: 300, y: 80, w: 180, h: 170, color: '#0f1a2e', glow: '#ff00ff', icon: '🏛️', floors: 4 },
  { name: '商店', x: 540, y: 120, w: 130, h: 130, color: '#0d1525', glow: '#ff6600', icon: '🛒', floors: 3 },
  { name: '广场', x: 320, y: 320, w: 200, h: 140, color: '#080e1c', glow: '#00ff88', icon: '⛲', floors: 0 },
  { name: '菜园', x: 80, y: 340, w: 150, h: 120, color: '#0a1a10', glow: '#39ff14', icon: '🌱', floors: 1 },
  { name: '钓鱼', x: 580, y: 330, w: 140, h: 130, color: '#081020', glow: '#00bfff', icon: '🎣', floors: 1 },
  { name: '房子区', x: 560, y: 50, w: 170, h: 140, color: '#1a0a1e', glow: '#ff44cc', icon: '🏠', floors: 3 },
]

const AGENTS = Array.from({ length: 12 }, (_, i) => ({
  emoji: ['🤖','🐱','🦊','🐸','🐻','🦁','🐼','🐨','🦄','🐙','🦋','🐺'][i],
  name: `Agent${i + 1}`,
  baseX: 100 + Math.random() * 600,
  baseY: 100 + Math.random() * 350,
  speed: 0.3 + Math.random() * 0.5,
  phase: Math.random() * Math.PI * 2,
}))

export default function TownMap({ onBuildingClick }: { onBuildingClick: (name: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoverRef = useRef<string | null>(null)
  const frameRef = useRef(0)

  const draw = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, t: number) => {
    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#020810')
    bg.addColorStop(0.5, '#0a0e1a')
    bg.addColorStop(1, '#0d0520')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % W, sy = (i * 73.1) % (H * 0.4)
      const a = 0.3 + 0.3 * Math.sin(t * 0.002 + i)
      ctx.fillStyle = `rgba(255,255,255,${a})`
      ctx.fillRect(sx, sy, 1.5, 1.5)
    }

    // Roads with glow
    const drawRoad = (x1: number, y1: number, x2: number, y2: number, color: string) => {
      ctx.save()
      ctx.strokeStyle = '#0a0f1a'
      ctx.lineWidth = 28
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      ctx.shadowColor = color; ctx.shadowBlur = 12
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.setLineDash([8, 12])
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
    drawRoad(0, 280, W, 280, '#ff6600')
    drawRoad(260, 0, 260, H, '#00f0ff')
    drawRoad(520, 0, 520, H, '#ff00ff')

    // Light particles on roads
    for (let i = 0; i < 8; i++) {
      const px = ((t * 0.1 + i * 100) % W)
      ctx.save()
      ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 8
      ctx.fillStyle = '#ff8800'
      ctx.beginPath(); ctx.arc(px, 280, 2, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    // Buildings
    const hov = hoverRef.current
    for (const b of BUILDINGS) {
      const isHover = hov === b.name
      const glowStr = isHover ? 25 : 10
      ctx.save()

      // Building body
      ctx.shadowColor = b.glow; ctx.shadowBlur = glowStr
      ctx.fillStyle = b.color
      ctx.fillRect(b.x, b.y, b.w, b.h)

      // Border glow
      ctx.strokeStyle = b.glow
      ctx.lineWidth = isHover ? 2.5 : 1.2
      ctx.shadowBlur = glowStr
      ctx.strokeRect(b.x, b.y, b.w, b.h)

      // Windows
      if (b.floors > 0) {
        const cols = Math.floor(b.w / 28)
        const rows = b.floors
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const wx = b.x + 14 + c * 26
            const wy = b.y + 18 + r * (b.h / (rows + 1))
            const lit = Math.sin(t * 0.001 + r * 3 + c * 7 + BUILDINGS.indexOf(b)) > -0.3
            if (lit) {
              const wc = Math.random() > 0.7 ? '#ffdd44' : '#44ddff'
              ctx.shadowColor = wc; ctx.shadowBlur = 6
              ctx.fillStyle = wc
            } else {
              ctx.shadowBlur = 0
              ctx.fillStyle = '#0a1020'
            }
            ctx.fillRect(wx, wy, 10, 8)
          }
        }
      }

      // Neon sign (building name)
      ctx.shadowColor = b.glow; ctx.shadowBlur = 15
      ctx.fillStyle = b.glow
      ctx.font = 'bold 13px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 8)

      // Icon
      ctx.shadowBlur = 0
      ctx.font = '22px serif'
      ctx.fillText(b.icon, b.x + b.w / 2, b.y + b.h / 2 + 8)

      ctx.restore()
    }

    // Fountain glow for 广场
    const plaza = BUILDINGS[3]
    ctx.save()
    const fR = 15 + 5 * Math.sin(t * 0.003)
    ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 20
    ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, fR, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.arc(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, fR * 0.5, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()

    // Water reflection for 钓鱼
    const fish = BUILDINGS[5]
    ctx.save()
    for (let i = 0; i < 5; i++) {
      const wy = fish.y + fish.h - 15 + i * 6
      const a = 0.15 + 0.1 * Math.sin(t * 0.002 + i)
      ctx.strokeStyle = `rgba(0,191,255,${a})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(fish.x + 5, wy)
      ctx.bezierCurveTo(fish.x + 35, wy - 4 * Math.sin(t * 0.003 + i), fish.x + 70, wy + 4 * Math.sin(t * 0.003 + i + 1), fish.x + fish.w - 5, wy)
      ctx.stroke()
    }
    ctx.restore()

    // Neon trees
    const trees = [[50, 200], [250, 420], [500, 260], [700, 180], [150, 480], [650, 440]]
    for (const [tx, ty] of trees) {
      ctx.save()
      ctx.fillStyle = '#1a0a0a'; ctx.fillRect(tx - 2, ty, 4, 18)
      ctx.shadowColor = '#39ff14'; ctx.shadowBlur = 12
      ctx.fillStyle = '#0a3a0a'
      ctx.beginPath(); ctx.arc(tx, ty - 5, 14, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#39ff14'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(tx, ty - 5, 14, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()
    }

    // Street lamps
    const lamps = [[40, 275], [200, 275], [400, 275], [600, 275], [255, 150], [515, 150]]
    for (const [lx, ly] of lamps) {
      ctx.save()
      ctx.fillStyle = '#222'; ctx.fillRect(lx - 1, ly - 25, 2, 25)
      ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 20
      ctx.fillStyle = '#ffaa00'
      ctx.beginPath(); ctx.arc(lx, ly - 27, 4, 0, Math.PI * 2); ctx.fill()
      // Light pool
      const pool = ctx.createRadialGradient(lx, ly, 0, lx, ly, 35)
      pool.addColorStop(0, 'rgba(255,170,0,0.08)')
      pool.addColorStop(1, 'rgba(255,170,0,0)')
      ctx.fillStyle = pool
      ctx.fillRect(lx - 35, ly - 35, 70, 70)
      ctx.restore()
    }

    // Agents
    for (const a of AGENTS) {
      const ax = a.baseX + Math.sin(t * 0.001 * a.speed + a.phase) * 40
      const ay = a.baseY + Math.cos(t * 0.001 * a.speed + a.phase + 1) * 20
      ctx.save()
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 6
      ctx.font = '16px serif'; ctx.textAlign = 'center'
      ctx.fillText(a.emoji, ax, ay)
      ctx.shadowBlur = 0
      ctx.fillStyle = '#88ccff'; ctx.font = '8px monospace'
      ctx.fillText(a.name, ax, ay + 14)
      ctx.restore()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const resize = () => { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    let running = true
    const loop = (t: number) => {
      if (!running) return
      const ctx = canvas.getContext('2d')
      if (ctx) draw(ctx, canvas.width, canvas.height, t)
      frameRef.current = requestAnimationFrame(loop)
    }
    frameRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(frameRef.current); ro.disconnect() }
  }, [draw])

  const getBuilding = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    return BUILDINGS.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) || null
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: hoverRef.current ? 'pointer' : 'default' }}
      onClick={e => { const b = getBuilding(e); if (b) onBuildingClick(b.name) }}
      onMouseMove={e => { const b = getBuilding(e); hoverRef.current = b?.name || null }}
    />
  )
}
