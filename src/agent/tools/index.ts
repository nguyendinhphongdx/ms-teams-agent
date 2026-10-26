import { AgentTool } from './tool.interface';
import { replyToChannelTool } from './reply-to-channel.tool';
import { getCurrentTimeTool } from './get-current-time.tool';
import { calculateTool } from './calculate.tool';

export * from './tool.interface';

/**
 * Danh sách tool cho AI.
 *
 * Thêm tool mới:
 *   1. Tạo file mới trong thư mục này theo mẫu 3 file trên (1 object `AgentTool`).
 *   2. Import và thêm vào mảng `tools` dưới đây.
 *
 * Ví dụ gọi API nội bộ:
 *   export const getBuildStatusTool: AgentTool<{ project: string }> = {
 *     definition: {
 *       name: 'get_build_status',
 *       description: 'Lấy trạng thái pipeline GitLab gần nhất của project',
 *       parameters: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] },
 *     },
 *     execute: async ({ project }) => (await fetch(`http://internal-api/builds/${project}`)).json(),
 *   };
 */
export const tools: AgentTool[] = [replyToChannelTool, getCurrentTimeTool, calculateTool];
