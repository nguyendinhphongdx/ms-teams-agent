import { AgentTool } from './tool.interface';

/** Tool bắt buộc: mọi câu trả lời gửi cho người dùng phải đi qua tool này */
export const replyToChannelTool: AgentTool<{ text: string }> = {
  definition: {
    name: 'reply_to_channel',
    description:
      'Gửi câu trả lời vào channel/thread MS Teams nơi người dùng vừa @mention bot. ' +
      'Dùng tool này cho MỌI câu trả lời gửi người dùng. Có thể gọi nhiều lần (vd báo "đang xử lý" rồi gửi kết quả).',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Nội dung trả lời, hỗ trợ markdown cơ bản' },
      },
      required: ['text'],
    },
  },
  execute: async (input, ctx) => {
    await ctx.replyToChannel(input.text);
    return { ok: true };
  },
};
