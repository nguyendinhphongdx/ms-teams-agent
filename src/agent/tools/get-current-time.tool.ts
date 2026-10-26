import { AgentTool } from './tool.interface';

export const getCurrentTimeTool: AgentTool<Record<string, never>> = {
  definition: {
    name: 'get_current_time',
    description: 'Lấy ngày giờ hiện tại theo múi giờ Asia/Ho_Chi_Minh.',
    parameters: { type: 'object', properties: {} },
  },
  execute: async () => ({
    now: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  }),
};
