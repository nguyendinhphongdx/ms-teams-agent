/**
 * Hợp đồng chung cho mọi tool mà AI có thể gọi.
 * Thêm tool mới = tạo 1 file trong thư mục này implement interface này, không sửa file khác
 * (xem `index.ts` để biết cách đăng ký tool mới vào danh sách).
 */
export interface ToolContext {
  user: string;
  replyToChannel: (markdown: string) => Promise<void>;
}

export interface AgentTool<TInput = any> {
  definition: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema của tham số, gửi cho model
  };
  execute: (input: TInput, ctx: ToolContext) => Promise<unknown>;
}
