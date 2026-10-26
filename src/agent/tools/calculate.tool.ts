import { AgentTool } from './tool.interface';

// Chỉ cho phép số và toán tử để tránh chạy code tuỳ ý qua Function()
const SAFE_EXPRESSION = /^[\d\s+\-*/().%]+$/;

export const calculateTool: AgentTool<{ expression: string }> = {
  definition: {
    name: 'calculate',
    description: 'Tính một biểu thức số học đơn giản, vd "(12 + 8) * 3 / 4".',
    parameters: {
      type: 'object',
      properties: { expression: { type: 'string' } },
      required: ['expression'],
    },
  },
  execute: async ({ expression }) => {
    if (!SAFE_EXPRESSION.test(expression)) return { error: 'Biểu thức không hợp lệ' };
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression});`)();
    return { expression, result };
  },
};
