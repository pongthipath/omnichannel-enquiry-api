import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';

/**
 * Graceful shutdown (design §15.4): on SIGTERM mark the instance as not ready so the
 * load balancer stops routing new requests, then give in-flight requests time to finish.
 */
@Injectable()
export class ShutdownState implements BeforeApplicationShutdown {
  private readonly logger = new Logger(ShutdownState.name);
  private shuttingDown = false;

  constructor(private readonly drainMs = Number(process.env.SHUTDOWN_DRAIN_MS ?? 20_000)) {}

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.shuttingDown = true;
    this.logger.log(`received ${signal ?? 'shutdown'}, draining for ${this.drainMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, this.drainMs));
  }
}
