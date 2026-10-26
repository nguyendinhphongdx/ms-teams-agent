import { Injectable } from '@nestjs/common';
import { Content, GoogleGenAI, Part } from '@google/genai';
import { ToolContext } from './tools';
import { ToolRegistryService } from './tool-registry.service';
import { config, isAiEnabled } from '../config/config';

interface RunParams {
  conversationKey: string; // id của channel/thread -> giữ lịch sử hội thoại theo thread
  input: string;
  user: string;
  replyToChannel: (markdown: string) => Promise<void>;
  sendTyping: () => Promise<void>;
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI trong Microsoft Teams của công ty.
- Trả lời bằng ngôn ngữ người dùng dùng (mặc định tiếng Việt), ngắn gọn, rõ ràng.
- LUÔN gửi câu trả lời cho người dùng bằng tool reply_to_channel; văn bản ngoài tool sẽ không hiển thị.
- Dùng các tool khác khi cần dữ liệu thực tế thay vì đoán.`;

const MAX_TURNS = 8;
const MAX_HISTORY = 20;

/**
 * Vòng lặp "agent" dùng Gemini function calling. Không biết tool chạy/log ra sao
 * (xem ToolRegistryService) và không biết tin nhắn tới từ Teams, Playground hay nơi khác
 * (xem RunParams — chỉ cần một hàm replyToChannel/sendTyping).
 */
@Injectable()
export class AgentService {
  private readonly client = isAiEnabled()
    ? new GoogleGenAI({
        apiKey: config.gemini.apiKey,
        ...(config.gemini.baseUrl ? { httpOptions: { baseUrl: config.gemini.baseUrl } } : {}),
      })
    : null;

  // Lịch sử hội thoại theo thread. Production nhiều replica: chuyển sang Redis/DB.
  private readonly history = new Map<string, Content[]>();

  constructor(private readonly toolRegistry: ToolRegistryService) {}

  async run(p: RunParams): Promise<void> {
    const ctx: ToolContext = { user: p.user, replyToChannel: p.replyToChannel };

    if (!this.client) {
      await this.runEchoMode(p, ctx);
      return;
    }

    const contents: Content[] = [...(this.history.get(p.conversationKey) ?? [])];
    contents.push({ role: 'user', parts: [{ text: `${p.user}: ${p.input}` }] });

    let justReplied = false;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // Không hiện "đang gõ" ngay sau khi vừa gửi câu trả lời
      if (turn > 0 && !justReplied) void p.sendTyping();

      const res = await this.client.models.generateContent({
        model: config.gemini.model,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: this.toolRegistry.definitions() }],
        },
      });

      // Giữ NGUYÊN content của model (kể cả thoughtSignature) - Gemini 3+ cần khi gọi tool nhiều lượt
      const modelContent = res.candidates?.[0]?.content;
      if (modelContent) contents.push(modelContent);

      const calls = res.functionCalls ?? [];
      if (calls.length === 0) {
        // Model trả text mà không gọi tool -> vẫn gửi ra cho người dùng
        const text = (res.text ?? '').trim();
        if (text) await p.replyToChannel(text);
        break;
      }

      const responseParts: Part[] = [];
      justReplied = false;
      for (const call of calls) {
        const name = call.name ?? '';
        if (name === 'reply_to_channel') justReplied = true;
        const out = await this.toolRegistry.execute(name, call.args ?? {}, ctx);
        responseParts.push({ functionResponse: { id: call.id, name, response: { result: out } } });
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    this.history.set(p.conversationKey, this.trimHistory(contents));
  }

  /** Chưa có GEMINI_API_KEY -> vẫn đi qua tool reply để test luồng Teams, không gọi AI thật */
  private async runEchoMode(p: RunParams, ctx: ToolContext): Promise<void> {
    await new Promise((r) => setTimeout(r, 800)); // giả lập LLM đang nghĩ
    await this.toolRegistry.execute('reply_to_channel', { text: `🔁 (echo mode) ${p.user} nói: **${p.input}**` }, ctx);
  }

  /** Giữ N lượt gần nhất, cắt sao cho bắt đầu bằng 1 lượt user dạng text (không mồ côi functionResponse) */
  private trimHistory(contents: Content[]): Content[] {
    let start = Math.max(0, contents.length - MAX_HISTORY);
    while (start < contents.length && !(contents[start].role === 'user' && contents[start].parts?.[0]?.text !== undefined)) {
      start++;
    }
    return contents.slice(start);
  }
}
