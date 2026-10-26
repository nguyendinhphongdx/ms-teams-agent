import { Injectable, Logger } from '@nestjs/common';
import { tools, ToolContext } from './tools';
import { EventLogService } from '../common/services/event-log.service';

/**
 * Tra và chạy tool theo tên, có log/nhật ký.
 * Tách riêng khỏi AgentService để AgentService chỉ lo vòng lặp gọi Gemini — không cần biết
 * tool được tra cứu, log hay bắt lỗi ra sao.
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);

  constructor(private readonly events: EventLogService) {}

  /** Schema gửi cho Gemini (functionDeclarations) */
  definitions() {
    return tools.map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      parametersJsonSchema: t.definition.parameters,
    }));
  }

  async execute(name: string, input: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = tools.find((t) => t.definition.name === name);
    this.logger.log(`tool → ${name} ${JSON.stringify(input)}`);
    if (name !== 'reply_to_channel') this.events.add({ kind: 'tool', text: `${name}(${JSON.stringify(input)})` });
    if (!tool) return { error: `Unknown tool: ${name}` };

    try {
      return await tool.execute(input, ctx);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
}
