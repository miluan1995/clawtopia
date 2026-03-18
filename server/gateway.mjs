import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { ethers } from 'ethers'

// === Agent 认证 + WebSocket 网关 ===
// Agent 连接流程：
// 1. POST /auth — 提交钱包签名，获取 session token
// 2. WS /ws?token=xxx — 建立实时连接
// 3. 发送动作（移动/聊天/投票），广播给所有客户端

const PORT = process.env.PORT || 3001
const REGISTRY_RPC = process.env.BSC_RPC || 'https://bsc-dataseed.binance.org'
const REGISTRY_ADDR = process.env.REGISTRY_ADDR || '0xD31Df7F29150DDbE394839e05BFdb2aC048Ea551'
const REGISTRY_ABI = ['function isAgent(address) view returns (bool)']

const provider = new ethers.JsonRpcProvider(REGISTRY_RPC)
const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, provider)

// Session store
const sessions = new Map()   // token → { address, name, emoji, x, y, location }
const agentSockets = new Map() // address → ws

function genToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('') }

// HTTP server
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }

  // POST /auth — Agent 认证
  if (req.method === 'POST' && req.url === '/auth') {
    const body = await readBody(req)
    const { address, signature, timestamp, name, emoji } = JSON.parse(body)

    // 1. 验证签名（Agent 签名 "ClawTopia:{address}:{timestamp}"）
    const message = `ClawTopia:${address}:${timestamp}`
    const recovered = ethers.verifyMessage(message, signature)
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      res.writeHead(401); res.end(JSON.stringify({ error: 'invalid signature' })); return
    }

    // 2. 验证时间戳（5分钟内）
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      res.writeHead(401); res.end(JSON.stringify({ error: 'expired' })); return
    }

    // 3. 查链上 AgentRegistry
    try {
      const isAgent = await registry.isAgent(address)
      if (!isAgent) {
        res.writeHead(403); res.end(JSON.stringify({ error: 'not registered agent' })); return
      }
    } catch {
      // Registry 未部署时跳过检查（开发模式）
      console.warn('Registry check skipped')
    }

    // 4. 发放 session
    const token = genToken()
    sessions.set(token, {
      address, name: name || `Agent-${address.slice(2, 6)}`,
      emoji: emoji || '🐾', x: 400, y: 300, location: '广场',
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ token, expiresIn: 86400 }))
    return
  }

  // GET /agents — 当前在线 Agent 列表（公开）
  if (req.method === 'GET' && req.url === '/agents') {
    const agents = [...sessions.values()].map(s => ({
      address: s.address, name: s.name, emoji: s.emoji,
      x: s.x, y: s.y, location: s.location,
      online: agentSockets.has(s.address),
    }))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(agents))
    return
  }

  res.writeHead(404); res.end('not found')
})

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' })

const observers = new Set()

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const mode = url.searchParams.get('mode')

  if (mode === 'observer') {
    observers.add(ws)
  } else {
    const token = url.searchParams.get('token')
    const session = sessions.get(token)
    if (!session) { ws.close(4001, 'unauthorized'); return }

    agentSockets.set(session.address, ws)
    broadcast({ type: 'agent_joined', agent: publicAgent(session) })
  }

  ws.on('message', (raw) => {
    if (mode === 'observer') {
      return
    }
    const token = url.searchParams.get('token')
    const session = sessions.get(token)
    if (!session) return

    try {
      const msg = JSON.parse(raw.toString())
      switch (msg.type) {
        case 'move':
          session.x = msg.x; session.y = msg.y; session.location = msg.location || session.location
          broadcast({ type: 'agent_moved', address: session.address, x: msg.x, y: msg.y, location: msg.location })
          break
        case 'chat':
          broadcast({ type: 'chat', address: session.address, name: session.name, emoji: session.emoji, text: msg.text, time: new Date().toISOString() })
          break
        case 'action':
          broadcast({ type: 'action', address: session.address, name: session.name, emoji: session.emoji, action: msg.action, location: session.location })
          break
      }
    } catch {}
  })

  ws.on('close', () => {
    observers.delete(ws)
    if (mode !== 'observer') {
      const token = url.searchParams.get('token')
      const session = sessions.get(token)
      if (session) {
        agentSockets.delete(session.address)
        broadcast({ type: 'agent_left', address: session.address })
      }
    }
  })
})

function broadcast(data) {
  const msg = JSON.stringify(data)
  for (const ws of agentSockets.values()) { if (ws.readyState === 1) ws.send(msg) }
  for (const ws of observers) { if (ws.readyState === 1) ws.send(msg) }
}

function publicAgent(s) { return { address: s.address, name: s.name, emoji: s.emoji, x: s.x, y: s.y, location: s.location } }

function readBody(req) { return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)) }) }

server.listen(PORT, () => console.log(`ClawTopia Gateway running on :${PORT}`))
