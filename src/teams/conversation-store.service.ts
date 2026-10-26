import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConversationReference } from 'botbuilder';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config/config';

/** Một nơi bot có thể gửi tin: channel trong team, group chat, hoặc chat 1-1 */
export interface StoredConversation {
  conversationId: string; // id gốc, KHÔNG có ";messageid=..." (vd 19:xxx@thread.tacv2)
  type: 'channel' | 'groupChat' | 'personal';
  name?: string; // tên channel (vd "ai-bot") nếu biết
  teamId?: string;
  teamName?: string;
  reference: Partial<ConversationReference>;
  updatedAt: string;
}

/**
 * Lưu "địa chỉ" (ConversationReference) của các nơi bot đã được cài / đã nhận tin,
 * để API /api/notify gửi tin chủ động vào đó.
 * Dev: lưu file JSON. Production: chuyển sang DB/Redis (vd khi chạy nhiều replica).
 */
@Injectable()
export class ConversationStoreService implements OnModuleInit {
  private readonly logger = new Logger(ConversationStoreService.name);
  private readonly file = config.conversationStoreFile;
  private readonly items = new Map<string, StoredConversation>();

  async onModuleInit(): Promise<void> {
    try {
      const list: StoredConversation[] = JSON.parse(await fs.readFile(this.file, 'utf8'));
      list.forEach((c) => this.items.set(c.conversationId, c));
      this.logger.log(`Loaded ${list.length} conversation(s) from ${this.file}`);
    } catch {
      // chưa có file -> bắt đầu rỗng
    }
  }

  static baseId(conversationId: string): string {
    return conversationId.split(';')[0];
  }

  list(): StoredConversation[] {
    return [...this.items.values()];
  }

  get(conversationId: string): StoredConversation | undefined {
    return this.items.get(ConversationStoreService.baseId(conversationId));
  }

  /** Tìm theo id hoặc theo tên channel (không phân biệt hoa thường) */
  find(key: string): StoredConversation | undefined {
    return this.get(key) ?? this.list().find((c) => c.name && c.name.toLowerCase() === key.toLowerCase());
  }

  async upsert(entry: Omit<StoredConversation, 'updatedAt'>): Promise<void> {
    const id = ConversationStoreService.baseId(entry.conversationId);
    const prev = this.items.get(id);
    const reference = { ...entry.reference, conversation: { ...entry.reference.conversation!, id } };
    this.items.set(id, {
      ...prev,
      ...entry,
      conversationId: id,
      // giữ tên cũ nếu lần này không có tên (activity message thường không kèm tên channel)
      name: entry.name ?? prev?.name,
      teamName: entry.teamName ?? prev?.teamName,
      reference,
      updatedAt: new Date().toISOString(),
    });
    await this.persist();
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.list(), null, 2));
  }
}
