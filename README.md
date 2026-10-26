# ms-teams-agent

Bot Microsoft Teams chạy trên NestJS: người dùng `@mention` bot trong channel, một AI agent
(Gemini, gọi tool) xử lý yêu cầu và trả lời vào đúng thread. Kèm API để hệ thống khác
(CI/CD, cron, service nội bộ) chủ động gửi tin vào Teams, và một trang quản trị để theo dõi,
thao tác nhanh không cần `curl`.

**Tính năng**

- `@mention` bot trong channel → AI trả lời vào đúng thread (`src/teams`, `src/agent`)
- `POST /api/notify` — gửi tin vào Teams từ hệ thống khác, không cần ai gõ gì (`src/notify`)
- Trang quản trị tại `/` — trạng thái bot, danh sách channel, soạn & gửi tin, nhật ký realtime
- Test local đầy đủ bằng Microsoft 365 Agents Playground — **không cần tenant M365, không cần
  xin IT, không cần ngrok**

## Luồng hoạt động

### Local — Agents Playground

Playground đóng vai "Teams giả" chạy ngay trên máy, gửi request giống hệt Teams thật và nhận
lại câu trả lời. Không có mạng Microsoft nào ở giữa.

```
Agents Playground (localhost:56150)
  │  gõ "@CMC Assistant ..."
  ▼
POST http://localhost:3978/api/messages      (không JWT — chế độ ANONYMOUS)
  │
  ▼
TeamsBotController → BotActivityHandler
  │  bỏ thẻ <at>, lưu "địa chỉ" conversation, trả 200 ngay
  ▼
AgentService  ──tool_use──▶  Gemini API (hoặc ECHO mode nếu chưa có GEMINI_API_KEY)
  │
  ▼  tool reply_to_channel
continueConversationAsync → Playground hiện câu trả lời
```

### Production — Teams thật

Microsoft đứng giữa, chuyển tiếp theo mô hình webhook hai chiều: Teams gọi vào bot qua
**Bot Framework Service**, bot gọi ngược lại qua cùng dịch vụ đó để trả lời.

```
Người dùng gõ "@CMC Assistant ..." trong Teams
  │
  ▼
Bot Framework Service (cloud Microsoft)
  │  tra endpoint đã đăng ký cho App ID của bot
  │  POST https://<domain>/api/messages, kèm JWT do Microsoft ký
  ▼
Traefik (TLS) → container ms-teams-agent (NestJS, NODE_ENV=production)
  │  verify JWT bằng MicrosoftAppId/Password/TenantId — 401 nếu không hợp lệ
  │  BotActivityHandler → AgentService → Gemini API
  ▼
continueConversationAsync
  │  xin access token bằng MicrosoftAppId + MicrosoftAppPassword
  │  POST {serviceUrl}/v3/conversations/{id}/activities
  ▼
Bot Framework Service → Teams → tin nhắn hiện trong thread
```

Khác biệt chính so với local: có domain public + TLS, bot bật xác thực JWT (`MicrosoftAppId`
được điền), và chiều trả lời cần access token thay vì gọi thẳng vào Playground.
Checklist đầy đủ để đi từ code xong tới chạy được trên Teams thật — tạo bot, lấy credentials,
sideload vào team, xin quyền IT, deploy — xem **[DEPLOY.md](./DEPLOY.md)**.

## Bắt đầu nhanh (local)

```bash
npm install
cp .env.example .env          # để trống MicrosoftApp* → bot chạy chế độ ANONYMOUS
npm run start:dev             # http://localhost:3978
```

Terminal khác:

```bash
npm install -g @microsoft/m365agentsplayground
npm run playground            # = agentsplayground -e http://localhost:3978/api/messages -c msteams
```

Mở `http://localhost:56150` → **Teams Channels** → gõ `@CMC Assistant xin chào`.

- Chưa có `GEMINI_API_KEY` → bot chạy **ECHO mode** (nhại lại tin nhắn), đủ để kiểm tra luồng
  Teams trước khi tốn token.
- Có `GEMINI_API_KEY` (lấy tại https://aistudio.google.com/apikey) → AI thật, mặc định
  `gemini-3.8-flash`. Thử: `@bot mấy giờ rồi?`, `@bot tính (12+8)*3`.
- Tên bot/team/channel/user giả trong Playground cấu hình ở `.m365agentsplayground.yml`
  (chỉ áp dụng khi chạy `npm run playground` trong thư mục project). Tên bot ở Teams thật lấy
  từ **Short name** của app trong Teams Developer Portal, không liên quan tới file này.

**Smoke test không cần mở Playground:**

```bash
npm run start:dev     # terminal 1
npm run test:e2e      # terminal 2 — giả lập Teams gửi @mention, kiểm tra bot trả lời đúng thread
```

## Cấu hình (`.env`)

| Biến | Bắt buộc khi | Mô tả |
|---|---|---|
| `PORT` | — | Cổng server, mặc định `3978` |
| `MicrosoftAppId` | chạy với Teams thật | Bot ID, từ Teams Developer Portal |
| `MicrosoftAppPassword` | chạy với Teams thật | Client secret của bot |
| `MicrosoftAppTenantId` | chạy với Teams thật | Tenant ID công ty |
| `GEMINI_API_KEY` | muốn AI thật thay vì ECHO mode | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | — | Mặc định `gemini-3.8-flash` |
| `GEMINI_BASE_URL` | dùng proxy/gateway nội bộ | Mặc định endpoint của Google |
| `NOTIFY_API_KEY` | production (bắt buộc), dev (tuỳ chọn) | Khoá cho `/api/notify` và `/api/admin/*` |
| `BOT_DISPLAY_NAME` | — | Tên bot hiện trong trang quản trị, mặc định `CMC Assistant` |
| `CONVERSATION_STORE_FILE` | — | File lưu địa chỉ conversation, mặc định `data/conversations.json` |

Để trống cả 3 biến `MicrosoftApp*` → bot chạy **ANONYMOUS**, chỉ dùng được với Agents
Playground. `NODE_ENV=production` mà thiếu `MicrosoftAppId` → server từ chối khởi động, tránh
expose `/api/messages` ra internet mà không xác thực.

Toàn bộ biến môi trường được đọc một lần ở `src/config/config.ts` — không có `process.env` nào
rải rác ở nơi khác trong code.

## Giao diện quản trị

Mở **http://localhost:3978/**: trạng thái bot, danh sách channel bot gửi được vào, form soạn
tin (có bản xem trước giống Teams), và nhật ký hoạt động cập nhật realtime. Nếu đã đặt
`NOTIFY_API_KEY`, trang sẽ hỏi key (lưu trong `localStorage` của trình duyệt, không gửi đi đâu
khác ngoài server này).

## API: gửi tin vào Teams (không cần @mention)

Cho hệ thống khác (CI/CD, cron, service nội bộ...) chủ động bắn tin vào channel.

**Điều kiện:** bot phải đã được cài vào team đó. Khi được cài, bot tự lưu "địa chỉ" mọi channel
trong team vào `data/conversations.json` (production nên chuyển sang DB — xem phần dưới).

```bash
# Xem bot gửi được vào đâu
curl -H "x-api-key: $NOTIFY_API_KEY" http://localhost:3978/api/notify/channels

# Tạo post MỚI trong channel (theo tên hoặc conversationId)
curl -X POST http://localhost:3978/api/notify \
  -H "Content-Type: application/json" -H "x-api-key: $NOTIFY_API_KEY" \
  -d '{"channel":"release","text":"🚀 Deploy **v1.2.0** thành công"}'
# → {"ok":true,"channel":"release","conversationId":"19:...","threadId":"1730000000000","messageId":"..."}

# Reply vào thread vừa tạo (dùng threadId trả về ở trên)
curl -X POST http://localhost:3978/api/notify \
  -H "Content-Type: application/json" -H "x-api-key: $NOTIFY_API_KEY" \
  -d '{"channel":"release","text":"Changelog: fix login","threadId":"1730000000000"}'
```

| Mã lỗi | Ý nghĩa |
|---|---|
| 400 | Thiếu `channel` hoặc `text` |
| 403 | Sai `x-api-key` (hoặc production chưa cấu hình `NOTIFY_API_KEY`) |
| 404 | Bot chưa biết channel đó → cài bot vào team, hoặc `@mention` bot trong channel một lần |

## Thêm tool cho AI

Tạo 1 file mới trong `src/agent/tools/` theo mẫu các tool có sẵn (`get-current-time.tool.ts`
là ngắn nhất để xem), rồi thêm vào mảng `tools` ở `src/agent/tools/index.ts`:

```ts
// src/agent/tools/get-build-status.tool.ts
import { AgentTool } from './tool.interface';

export const getBuildStatusTool: AgentTool<{ project: string }> = {
  definition: {
    name: 'get_build_status',
    description: 'Lấy trạng thái pipeline GitLab gần nhất của project',
    parameters: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] },
  },
  execute: async ({ project }) => (await fetch(`http://internal-api/builds/${project}`)).json(),
};
```

Mỗi tool nằm trong file riêng — thêm tool mới không phải sửa file ai khác đang dùng, tránh
đụng code khi nhiều người cùng thêm tool.

## Cấu trúc

Chia theo module NestJS, mỗi module một trách nhiệm:

```
src/
├─ main.ts                 # Bootstrap, guard production thiếu MicrosoftAppId
├─ app.module.ts           # Ghép các module dưới đây
├─ config/
│  └─ config.ts            # Toàn bộ biến môi trường, đọc 1 lần, gõ kiểu
├─ common/                 # Dùng chung giữa các module (CommonModule, @Global)
│  ├─ guards/api-key.guard.ts       # Guard cho /api/notify và /api/admin/*
│  └─ services/event-log.service.ts # Nhật ký hoạt động in-memory cho trang quản trị
├─ teams/                  # Mọi thứ nói chuyện với Bot Framework / Teams
│  ├─ teams.module.ts
│  ├─ teams-bot.controller.ts       # POST /api/messages, GET /health
│  ├─ bot-framework.provider.ts     # Factory tạo CloudAdapter (anonymous/auth)
│  ├─ bot-activity.handler.ts       # Routing: lọc @mention, chạy agent nền
│  ├─ conversation-sender.service.ts # Gửi tin chủ động — dùng chung cho reply & /api/notify
│  ├─ teams-installation.service.ts  # Ghi nhớ conversation + channel khi bot được cài
│  └─ conversation-store.service.ts  # Lưu địa chỉ các channel/chat bot đã biết (file JSON)
├─ agent/                  # Vòng lặp AI, độc lập với Teams
│  ├─ agent.module.ts
│  ├─ agent.service.ts             # Gemini function calling, lịch sử theo thread, ECHO mode
│  ├─ tool-registry.service.ts     # Tra + chạy tool theo tên, có log
│  └─ tools/                       # Mỗi tool 1 file (xem "Thêm tool cho AI")
├─ notify/
│  └─ notify.controller.ts # POST /api/notify, GET /api/notify/channels
└─ admin/
   └─ admin.controller.ts  # Phục vụ public/index.html + API trạng thái/nhật ký
```

| File khác | Vai trò |
|---|---|
| `public/index.html` | Giao diện quản trị (không build step) |
| `scripts/smoke-test.ts` | Test end-to-end giả lập Teams |
| `.m365agentsplayground.yml` | Dữ liệu giả (tên bot, team, channel, user) cho Agents Playground |
| `DEPLOY.md` | Checklist đầy đủ để chạy trên Teams thật |

## Trước khi lên production

- Lịch sử hội thoại và conversation store đang lưu in-memory/file JSON → chuyển sang Redis/DB
  nếu chạy nhiều replica.
- `runAgent` trong `bot-activity.handler.ts` chạy bằng `void` (fire-and-forget) → nên đưa vào
  hàng đợi (BullMQ) để không mất job khi container restart giữa chừng.
- Chỉ expose path `/api/messages` ra internet qua Traefik. `/api/notify` và `/api/admin/*` chỉ
  nên nằm trong mạng nội bộ, hoặc thêm một lớp xác thực khác nếu cần expose ra ngoài.
- Đặt `NOTIFY_API_KEY` đủ dài (`openssl rand -hex 32`), lưu trong GitLab CI variables (masked),
  không hard-code trong repo.
