/**
 * Smoke test không cần Teams/Playground:
 * - Dựng một "Teams giả" (serviceUrl) để hứng tin bot trả lời
 * - Gửi 1 activity @mention trong channel vào /api/messages
 * - Kiểm tra bot trả lời vào ĐÚNG conversation/thread
 *
 * Chạy: npm run start:dev  (terminal 1)  ->  npm run test:e2e  (terminal 2)
 */
import http from 'node:http';

const BOT_URL = process.env.BOT_URL ?? 'http://localhost:3978/api/messages';
const FAKE_PORT = 4999;
const CONVERSATION_ID = '19:testchannel@thread.tacv2;messageid=1700000000000';

const received: any[] = [];

const fakeTeams = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const activity = body ? JSON.parse(body) : {};
    received.push({ url: decodeURIComponent(req.url ?? ''), activity });
    console.log(`  ← bot gửi [${activity.type}] tới ${decodeURIComponent(req.url ?? '')}${activity.text ? `: ${activity.text}` : ''}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: `reply-${received.length}` }));
  });
});

async function main() {
  await new Promise<void>((r) => fakeTeams.listen(FAKE_PORT, r));

  const activity = {
    type: 'message',
    id: '1700000000001',
    timestamp: new Date().toISOString(),
    channelId: 'msteams',
    serviceUrl: `http://localhost:${FAKE_PORT}/`,
    from: { id: '29:user-1', name: 'Phong' },
    recipient: { id: '28:bot-1', name: 'MyAI' },
    conversation: { id: CONVERSATION_ID, isGroup: true, conversationType: 'channel', tenantId: 'tenant-1' },
    text: '<at>MyAI</at> xin chào, mấy giờ rồi?',
    entities: [{ type: 'mention', text: '<at>MyAI</at>', mentioned: { id: '28:bot-1', name: 'MyAI' } }],
    channelData: { tenant: { id: 'tenant-1' }, channel: { id: '19:testchannel@thread.tacv2' }, team: { id: '19:team@thread.tacv2' } },
  };

  console.log(`→ Gửi @mention tới ${BOT_URL}`);
  const res = await fetch(BOT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activity) });
  console.log(`  HTTP ${res.status} (phải trả nhanh, agent chạy nền)`);

  // Đợi agent trả lời (LLM có thể mất vài giây)
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline && !received.some((r) => r.activity.type === 'message')) {
    await new Promise((r) => setTimeout(r, 300));
  }

  const reply = received.find((r) => r.activity.type === 'message');
  fakeTeams.close();

  if (!reply) {
    console.error('✗ FAIL: không nhận được câu trả lời trong 60s');
    process.exit(1);
  }
  const sameThread = reply.url.includes(CONVERSATION_ID);
  console.log(sameThread ? '✓ PASS: bot trả lời đúng thread' : `✗ FAIL: sai conversation (${reply.url})`);
  process.exit(sameThread ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
