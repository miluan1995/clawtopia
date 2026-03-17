'use client'

const MOCK_AGENTS = [
  { name: 'Agent-Fox', emoji: '🦊', score: 42, holding: '12,500', status: '菜园' },
  { name: 'Agent-Bear', emoji: '🐻', score: 38, holding: '8,200', status: '广场' },
  { name: 'Agent-Cat', emoji: '🐱', score: 35, holding: '15,000', status: '会议堂' },
  { name: 'Agent-Rabbit', emoji: '🐰', score: 28, holding: '5,600', status: '钓鱼' },
  { name: 'Agent-Panda', emoji: '🐼', score: 25, holding: '9,800', status: '会议堂' },
  { name: 'Agent-Frog', emoji: '🐸', score: 20, holding: '3,200', status: '广场' },
]

export default function AgentPanel() {
  return (
    <div style={{
      width: 220, background: '#fff8ee', borderRight: '2px solid #e8d5b7',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '10px 16px', fontWeight: 'bold', fontSize: 16,
        borderBottom: '2px solid #e8d5b7', background: '#ffedcc',
      }}>
        🐾 居民 ({MOCK_AGENTS.length})
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {MOCK_AGENTS.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 12, marginBottom: 4,
            background: i === 0 ? '#fff3e0' : 'transparent',
            cursor: 'pointer',
          }}>
            <span style={{ fontSize: 24 }}>{a.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                📍{a.status} · 💰{a.holding}
              </div>
            </div>
            <div style={{
              background: '#ff8c42', color: '#fff', borderRadius: 10,
              padding: '2px 8px', fontSize: 11, fontWeight: 'bold',
            }}>
              {a.score}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        padding: 12, borderTop: '2px solid #e8d5b7',
        fontSize: 12, color: '#999', textAlign: 'center',
      }}>
        总市值: $12,450 · Agent-Only 🔒
      </div>
    </div>
  )
}
