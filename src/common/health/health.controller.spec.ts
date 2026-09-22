import { ServiceUnavailableException } from '@nestjs/common';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { ShutdownState } from './shutdown.state';

describe('HealthController', () => {
  const health = { check: jest.fn() } as unknown as HealthCheckService;
  const db = { pingCheck: jest.fn() } as unknown as TypeOrmHealthIndicator;

  const build = (shuttingDown: boolean) => {
    const shutdown = { isShuttingDown: shuttingDown } as ShutdownState;
    return new HealthController(health, db, shutdown);
  };

  beforeEach(() => jest.clearAllMocks());

  it('live ตอบ ok เสมอ', () => {
    expect(build(false).live()).toEqual({ status: 'ok' });
  });

  it('ready ตรวจฐานข้อมูลเมื่อไม่ได้กำลังปิดตัว', async () => {
    (health.check as jest.Mock).mockResolvedValue({ status: 'ok' });
    await expect(build(false).ready()).resolves.toEqual({ status: 'ok' });
    expect(health.check).toHaveBeenCalledTimes(1);
  });

  it('ready ตอบ 503 ระหว่างปิดตัว เพื่อให้ load balancer หยุดส่งงานมา', () => {
    expect(() => build(true).ready()).toThrow(ServiceUnavailableException);
    expect(health.check).not.toHaveBeenCalled();
  });
});
