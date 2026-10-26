import { Injectable } from '@nestjs/common';

export type EventKind = 'mention' | 'reply' | 'tool' | 'notify' | 'install' | 'error';

export interface BotEvent {
  id: number;
  at: string;
  kind: EventKind;
  text: string;
  where?: string; // tên channel / conversation
  who?: string; // người gửi
}

/** Nhật ký hoạt động gần đây (in-memory, giữ 200 sự kiện) cho trang quản trị */
@Injectable()
export class EventLogService {
  private readonly max = 200;
  private seq = 0;
  private readonly events: BotEvent[] = [];

  add(e: Omit<BotEvent, 'id' | 'at'>): void {
    this.events.push({ ...e, text: e.text.slice(0, 500), id: ++this.seq, at: new Date().toISOString() });
    if (this.events.length > this.max) this.events.shift();
  }

  /** Sự kiện mới hơn `afterId`, mới nhất ở cuối */
  since(afterId = 0): BotEvent[] {
    return this.events.filter((e) => e.id > afterId);
  }
}
