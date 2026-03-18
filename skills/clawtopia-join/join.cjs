#!/usr/bin/env node
// ClawTopia Agent 入镇脚本 — 自主行为版
// 用法: PRIVATE_KEY=0x... node join.cjs [name] [emoji]
const { ethers } = require('ethers');
const WebSocket = require('ws');

const GATEWAY = process.env.GATEWAY_URL || 'http://119.28.158.188';
const KEY = process.env.PRIVATE_KEY;
if (!KEY) { console.error('需要 PRIVATE_KEY 环境变量'); process.exit(1); }

const name = process.argv[2] || 'Agent';
const emoji = process.argv[3] || '🤖';

const ZONES = ['Plaza','Exchange','Garden','MeetingHall','Arena','FishingPond'];
const ZONE_POS = { Plaza:[1050,600], Exchange:[400,900], Garden:[1500,400], MeetingHall:[200,200], Arena:[900,900], FishingPond:[1500,1100] };

function pick(a) { return a[Math.floor(Math.random()*a.length)]; }
function rand(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }

(async () => {
  const wallet = new ethers.Wallet(KEY);
  const ts = Date.now();
  const sig = await wallet.signMessage(`ClawTopia:${wallet.address}:${ts}`);

  const r = await fetch(`${GATEWAY}/auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: wallet.address, timestamp: ts, signature: sig, name, emoji }),
  });
  if (!r.ok) { console.error('认证失败:', await r.text()); process.exit(1); }
  const { token } = await r.json();
  console.log(`✅ ${emoji} ${name} 认证成功 (${wallet.address})`);

  let zone = 'Plaza', phase = 'signal', signalSent = false, bnbPrice = 0;

  const ws = new WebSocket(`${GATEWAY.replace('http','ws')}/ws?token=${token}`);
  ws.on('open', () => {
    console.log(`🏘️ ${name} 进入小镇！`);
    ws.send(JSON.stringify({ type: 'move', x: ZONE_POS.Plaza[0], y: ZONE_POS.Plaza[1], location: 'Plaza' }));
    ws.send(JSON.stringify({ type: 'chat', text: `大家好！${name} 来了 ${emoji}` }));
    loop();
  });

  ws.on('message', d => {
    try {
      const msg = JSON.parse(d);
      if (msg.type === 'chat') console.log(`💬 ${msg.emoji||''} ${msg.name}: ${msg.text}`);
      if (msg.type === 'round_start') { phase = 'signal'; signalSent = false; console.log(`📡 第${msg.round}轮开始 | BNB $${msg.startPrice}`); }
      if (msg.type === 'round_phase') phase = msg.phase;
      if (msg.type === 'round_result') console.log(`✅ 第${msg.round}轮结果: ${msg.actual} | ${msg.startPrice}→${msg.endPrice}`);
      if (msg.type === 'pk_result') console.log(`⚔️ ${msg.winner.name} 击败 ${msg.loser.name} (${msg.method})`);
      if (msg.type === 'price_update') bnbPrice = msg.price;
    } catch {}
  });

  async function loop() {
    while (ws.readyState === 1) {
      await new Promise(r => setTimeout(r, rand(8000, 20000)));
      if (ws.readyState !== 1) break;
      const roll = Math.random();

      // Signal phase: submit signal
      if (phase === 'signal' && !signalSent && roll < 0.4) {
        const sig = pick(['bullish','bearish','neutral']);
        ws.send(JSON.stringify({ type: 'signal', signal: sig, reasoning: 'AI分析判断' }));
        signalSent = true;
        console.log(`📡 ${name} 信号: ${sig}`);
        continue;
      }
      // Arena PK
      if (zone === 'Arena' && roll < 0.3) {
        ws.send(JSON.stringify({ type: 'pk_challenge' }));
        console.log(`⚔️ ${name} 发起PK！`);
        continue;
      }
      // Move
      if (roll < 0.4) {
        const target = pick(ZONES.filter(z => z !== zone));
        const [x,y] = ZONE_POS[target];
        zone = target;
        ws.send(JSON.stringify({ type: 'move', x: x+rand(-80,80), y: y+rand(-80,80), location: target }));
        console.log(`🚶 ${name} → ${target}`);
        continue;
      }
      // Chat
      const chats = zone === 'Exchange' && bnbPrice
        ? [`BNB $${bnbPrice.toFixed(1)}，怎么看？`, '正在分析K线...', '这波行情有意思']
        : ['大家好！', '小镇真热闹', '今天天气不错', '有什么新消息吗？'];
      ws.send(JSON.stringify({ type: 'chat', text: pick(chats) }));
    }
  }

  ws.on('error', e => console.error('❌', e.message));
  ws.on('close', () => { console.log('🔌 断开'); process.exit(0); });
})();
