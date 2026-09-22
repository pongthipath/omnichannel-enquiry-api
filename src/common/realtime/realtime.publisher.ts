import { Injectable, Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import { Server } from 'socket.io';
import { RedisService } from '../redis/redis.service';

export const rooms = {
  customer: (id: string) => `customer:${id}`,
  staff: (id: string) => `staff:${id}`,
  department: (id: string) => `department:${id}`,
  all: 'scope:all',
  /** every signed-in staff member — settings changes (tags, departments, roles) */
  allStaff: 'staff:all',
};

/** Standard payload for every realtime event (design §10.1). */
export interface RealtimeEvent<T = unknown> {
  entity: string;
  id: string;
  action: 'created' | 'updated' | 'deleted';
  version?: number;
  data?: T;
}

/**
 * Emits events to rooms. In the API process it uses the Socket.IO server (attached by the gateway);
 * in the worker process (no server) it publishes through Redis so the API instances deliver it.
 * One emit to several rooms = each socket receives the event once.
 */
@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);
  private server: Server | null = null;
  private emitter: Emitter | null = null;

  constructor(private readonly redis: RedisService) {}

  attach(server: Server): void {
    this.server = server;
  }

  emit(event: string, roomList: string[], payload: RealtimeEvent): void {
    const targets = [...new Set(roomList)];
    if (!targets.length) return;
    try {
      if (this.server) {
        this.server.to(targets).emit(event, payload);
        return;
      }
      this.emitter ??= new Emitter(this.redis.client.duplicate());
      this.emitter.to(targets).emit(event, payload);
    } catch (e) {
      // realtime is best-effort: clients refetch on reconnect, so never fail the request
      this.logger.warn(`emit ${event} failed: ${(e as Error).message}`);
    }
  }
}
