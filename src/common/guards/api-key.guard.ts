import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../../config/config';

/**
 * Bảo vệ API nội bộ (/api/notify, /api/admin/*) bằng header `x-api-key` = NOTIFY_API_KEY.
 * Dev chưa đặt key: cho qua để test. Production chưa đặt key: khoá hẳn endpoint.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  static required(): boolean {
    return !!config.notifyApiKey;
  }

  canActivate(context: ExecutionContext): boolean {
    const expected = config.notifyApiKey;
    if (!expected) {
      if (config.isProduction) throw new ForbiddenException('NOTIFY_API_KEY chưa được cấu hình');
      return true;
    }
    const given = context.switchToHttp().getRequest().headers['x-api-key'] ?? '';
    if (!ApiKeyGuard.safeEqual(String(given), expected)) throw new ForbiddenException('Sai x-api-key');
    return true;
  }

  /** So sánh constant-time, tránh lộ thông tin qua timing attack */
  private static safeEqual(given: string, expected: string): boolean {
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
