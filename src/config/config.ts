import path from 'node:path';

const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const DEFAULT_BOT_DISPLAY_NAME = 'CMC Assistant';

/**
 * Toàn bộ biến môi trường của app, đọc một lần và export ra object đã gõ kiểu.
 *
 * Không đọc `process.env` trực tiếp ở nơi khác trong code — mọi thứ đi qua đây để:
 *  - có đúng một nơi biết "biến nào tồn tại, giá trị mặc định là gì"
 *  - không bị lệch khi 2 nơi khác nhau hard-code 2 default khác nhau
 *  - dễ thấy thiếu biến gì chỉ bằng cách đọc file này, không cần grep cả repo
 */
export const config = {
  port: Number(process.env.PORT) || 3978,
  isProduction: process.env.NODE_ENV === 'production',

  bot: {
    displayName: process.env.BOT_DISPLAY_NAME || DEFAULT_BOT_DISPLAY_NAME,
    appId: process.env.MicrosoftAppId ?? '',
    appPassword: process.env.MicrosoftAppPassword,
    tenantId: process.env.MicrosoftAppTenantId,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    // Tuỳ chọn: trỏ qua proxy/gateway nội bộ. Để trống = endpoint mặc định của Google.
    baseUrl: process.env.GEMINI_BASE_URL,
  },

  // Khoá cho POST /api/notify và /api/admin/*. Để trống: dev cho qua, production khoá endpoint.
  notifyApiKey: process.env.NOTIFY_API_KEY,

  conversationStoreFile: process.env.CONVERSATION_STORE_FILE || path.resolve('data/conversations.json'),
} as const;

/** Có credentials Teams thật -> bật xác thực JWT. Không có -> chế độ anonymous (Agents Playground). */
export const isBotAuthEnabled = (): boolean => !!config.bot.appId;

/** Có GEMINI_API_KEY -> gọi Gemini thật. Không có -> chế độ ECHO (nhại lại tin nhắn) để test luồng Teams. */
export const isAiEnabled = (): boolean => !!config.gemini.apiKey;
