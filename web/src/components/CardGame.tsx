'use client'
import { useState, useCallback } from 'react'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
type Card = { suit: typeof SUITS[number]; rank: typeof RANKS[number]; value: number }

function newDeck(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) for (let i = 0; i < RANKS.length; i++) d.push({ suit: s, rank: RANKS[i], value: i + 1 })
  return d.sort(() => Math.random() - 0.5)
}

const OPPONENTS = [
  { name: 'Agent-Fox', emoji: '🦊' },
  { name: 'Agent-Bear', emoji: '🐻' },
  { name: 'Agent-Cat', emoji: '🐱' },
  { name: 'Agent-Panda', emoji: '🐼' },
]

export default function CardGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'lobby'|'play'|'result'>('lobby')
  const [opponent] = useState(OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)])
  const [myCards, setMyCards] = useState<Card[]>([])
  const [opCards, setOpCards] = useState<Card[]>([])
  const [myPlay, setMyPlay] = useState<Card|null>(null)
  const [opPlay, setOpPlay] = useState<Card|null>(null)
  const [myScore, setMyScore] = useState(0)
  const [opScore, setOpScore] = useState(0)
  const [round, setRound] = useState(0)
  const [msg, setMsg] = useState('')
  const [reward, setReward] = useState(0)

  const startGame = useCallback(() => {
    const deck = newDeck()
    setMyCards(deck.slice(0, 5))
    setOpCards(deck.slice(5, 10))
    setMyPlay(null); setOpPlay(null)
    setMyScore(0); setOpScore(0); setRound(0); setMsg('选一张牌出战！')
    setPhase('play')
  }, [])

  const playCard = useCallback((idx: number) => {
    if (myPlay) return
    const mc = myCards[idx]
    const oi = Math.floor(Math.random() * opCards.length)
    const oc = opCards[oi]
    setMyPlay(mc); setOpPlay(oc)
    const newRound = round + 1
    let ms = myScore, os = opScore
    if (mc.value > oc.value) { ms++; setMsg(`你赢了这轮！${mc.rank}${mc.suit} > ${oc.rank}${oc.suit}`) }
    else if (mc.value < oc.value) { os++; setMsg(`${opponent.emoji} 赢了！${oc.rank}${oc.suit} > ${mc.rank}${mc.suit}`) }
    else { setMsg(`平局！都是 ${mc.rank}`) }
    setMyScore(ms); setOpScore(os); setRound(newRound)

    setTimeout(() => {
      setMyCards(c => c.filter((_, i) => i !== idx))
      setOpCards(c => c.filter((_, i) => i !== oi))
      setMyPlay(null); setOpPlay(null)
      if (newRound >= 5) {
        const r = ms > os ? Math.floor(Math.random() * 30) + 20 : ms === os ? 5 : 0
        setReward(r)
        setMsg(ms > os ? `🎉 你赢了！获得 ${r} $CLAW` : ms === os ? '平局，安慰奖 5 $CLAW' : `${opponent.emoji} ${opponent.name} 获胜`)
        setPhase('result')
      } else { setMsg('选下一张牌！') }
    }, 1200)
  }, [myCards, opCards, myPlay, round, myScore, opScore, opponent])

  const cardStyle = (c: Card, played?: boolean): React.CSSProperties => ({
    width: 56, height: 80, borderRadius: 10, border: '2px solid #ddd', background: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    cursor: played ? 'default' : 'pointer', fontSize: 14, fontWeight: 'bold',
    color: (c.suit === '♥' || c.suit === '♦') ? '#e74c3c' : '#2c3e50',
    boxShadow: played ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.1)',
    transform: played ? 'scale(1.15)' : 'none', transition: 'all 0.2s',
  })

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
      <div style={{ background: '#fff8ee', borderRadius: 20, padding: 28, width: 400, maxWidth: '95%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', border: '3px solid #ff8c42', animation: 'popIn 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 20 }}>🃏 PK 打牌</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {phase === 'lobby' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>比大小！5 轮对决，赢了拿 $CLAW</p>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{opponent.emoji}</div>
            <p style={{ fontWeight: 'bold', marginBottom: 16 }}>对手: {opponent.name}</p>
            <button onClick={startGame} style={{ background: 'linear-gradient(135deg, #ff8c42, #ffb347)', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }}>开始对战 ⚔️</button>
          </div>
        )}

        {phase === 'play' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: '#999' }}>第 {round + 1}/5 轮</span>
              <span style={{ margin: '0 12px', fontWeight: 'bold' }}>你 {myScore} : {opScore} {opponent.emoji}</span>
            </div>
            {/* 对手出牌区 */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{opponent.emoji} {opponent.name}</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {opPlay ? <div style={cardStyle(opPlay, true)}><div>{opPlay.suit}</div><div>{opPlay.rank}</div></div>
                  : <div style={{ width: 56, height: 80, borderRadius: 10, background: 'linear-gradient(135deg, #e74c3c, #c0392b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>?</div>}
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#ff8c42', fontWeight: 'bold', margin: '8px 0' }}>{msg}</div>
            {/* 我的出牌区 */}
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              {myPlay && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><div style={cardStyle(myPlay, true)}><div>{myPlay.suit}</div><div>{myPlay.rank}</div></div></div>}
            </div>
            {/* 手牌 */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              {myCards.map((c, i) => (
                <div key={i} onClick={() => playCard(i)} style={{ ...cardStyle(c), ...(myPlay ? { opacity: 0.4, cursor: 'default' } : {}) }}
                  onMouseEnter={e => { if (!myPlay) (e.currentTarget.style.transform = 'translateY(-6px)') }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
                  <div style={{ fontSize: 12 }}>{c.suit}</div>
                  <div>{c.rank}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 6 }}>你的手牌</div>
          </div>
        )}

        {phase === 'result' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{myScore > opScore ? '🎉' : myScore === opScore ? '🤝' : '😢'}</div>
            <p style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>{myScore} : {opScore}</p>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{msg}</p>
            {reward > 0 && <p style={{ fontSize: 16, color: '#ff8c42', fontWeight: 'bold', marginBottom: 16 }}>+{reward} $CLAW 💰</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={startGame} style={{ background: 'linear-gradient(135deg, #ff8c42, #ffb347)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>再来一局</button>
              <button onClick={onClose} style={{ background: '#eee', color: '#666', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}>离开</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
