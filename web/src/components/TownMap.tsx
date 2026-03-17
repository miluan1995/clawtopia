'use client'
import { useRef, useEffect } from 'react'

interface Building {
  name: string
  emoji: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

const BUILDINGS: Building[] = [
  { name: '会议堂', emoji: '🏛️', x: 350, y: 120, w: 120, h: 100, color: '#e8d5b7' },
  { name: '广场', emoji: '☕', x: 200, y: 280, w: 140, h: 80, color: '#d4e8c2' },
  { name: '菜园', emoji: '🌾', x: 520, y: 280, w: 120, h: 90, color: '#c8e6a0' },
  { name: '钓鱼', emoji: '🎣', x: 80, y: 400, w: 100, h: 80, color: '#b3d9f2' },
  { name: '商店', emoji: '🏪', x: 560, y: 140, w: 100, h: 80, color: '#f2d5b8' },
  { name: '交易所', emoji: '📊', x: 100, y: 140, w: 100, h: 80, color: '#d5c8f2' },
  { name: '房子区', emoji: '🏠', x: 400, y: 420, w: 160, h: 80, color: '#f2c8c8' },
]

// Q版 Agent 角色（随机走动）
interface Agent { id: string; x: number; y: number; dx: number; dy: number; color: string; emoji: string }

const AGENT_EMOJIS = ['🐱', '🐶', '🐻', '🐰', '🦊', '🐼', '🐨', '🐸', '🐵', '🦁']
const AGENT_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8', '#00b894', '#e17055']

function randomAgents(n: number): Agent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `agent-${i}`,
    x: 100 + Math.random() * 600,
    y: 100 + Math.random() * 400,
    dx: (Math.random() - 0.5) * 1.2,
    dy: (Math.random() - 0.5) * 1.2,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
    emoji: AGENT_EMOJIS[i % AGENT_EMOJIS.length],
  }))
}

export default function TownMap({ onBuildingClick }: { onBuildingClick: (name: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const agentsRef = useRef<Agent[]>(randomAgents(12))

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf: number

    const resize = () => { canvas.width = canvas.parentElement!.clientWidth; canvas.height = canvas.parentElement!.clientHeight }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.width, H = canvas.height
      // 背景草地
      ctx.fillStyle = '#a8d5a2'
      ctx.fillRect(0, 0, W, H)

      // 小路
      ctx.strokeStyle = '#d4c4a0'
      ctx.lineWidth = 20
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(W * 0.5, 0); ctx.lineTo(W * 0.5, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, H * 0.45); ctx.lineTo(W, H * 0.45); ctx.stroke()

      // 建筑
      for (const b of BUILDINGS) {
        const bx = b.x / 800 * W, by = b.y / 550 * H, bw = b.w / 800 * W, bh = b.h / 550 * H
        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.08)'
        ctx.beginPath(); ctx.roundRect(bx + 3, by + 3, bw, bh, 12); ctx.fill()
        // 建筑体
        ctx.fillStyle = b.color
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill()
        ctx.strokeStyle = '#8b7355'
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.stroke()
        // Emoji + 名字
        ctx.font = `${Math.max(24, bw * 0.25)}px serif`
        ctx.textAlign = 'center'
        ctx.fillText(b.emoji, bx + bw / 2, by + bh * 0.45)
        ctx.font = `bold ${Math.max(11, bw * 0.12)}px "Comic Sans MS", cursive`
        ctx.fillStyle = '#3d2c1e'
        ctx.fillText(b.name, bx + bw / 2, by + bh * 0.75)
      }

      // Agent 角色
      const agents = agentsRef.current
      for (const a of agents) {
        // 移动
        a.x += a.dx; a.y += a.dy
        if (a.x < 30 || a.x > W - 30) a.dx *= -1
        if (a.y < 30 || a.y > H - 30) a.dy *= -1
        // 随机转向
        if (Math.random() < 0.01) { a.dx = (Math.random() - 0.5) * 1.2; a.dy = (Math.random() - 0.5) * 1.2 }

        // 画角色（圆形底座 + emoji）
        ctx.fillStyle = a.color + '40'
        ctx.beginPath(); ctx.arc(a.x, a.y + 8, 14, 0, Math.PI * 2); ctx.fill()
        ctx.font = '22px serif'
        ctx.textAlign = 'center'
        ctx.fillText(a.emoji, a.x, a.y + 6)
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    // 点击建筑
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      const W = canvas.width, H = canvas.height
      for (const b of BUILDINGS) {
        const bx = b.x / 800 * W, by = b.y / 550 * H, bw = b.w / 800 * W, bh = b.h / 550 * H
        if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
          onBuildingClick(b.name)
          return
        }
      }
    }
    canvas.addEventListener('click', handleClick)

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.removeEventListener('click', handleClick) }
  }, [onBuildingClick])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', cursor: 'pointer' }} />
}
