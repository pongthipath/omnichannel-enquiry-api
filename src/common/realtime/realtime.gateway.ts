import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { isStaff } from '../auth/actor';
import { AuthGuard } from '../auth/auth.guard';
import { Permission } from '../permissions/permission.enum';
import { RealtimePublisher, rooms } from './realtime.publisher';

/**
 * Socket.IO entry point. Rooms are chosen by the server from the verified token — clients cannot
 * ask to join other rooms (design §16.5).
 */
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN?.split(','), credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly auth: AuthGuard,
    private readonly publisher: RealtimePublisher,
  ) {}

  afterInit(server: Server): void {
    this.publisher.attach(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const actor = await this.auth.authenticate(token ? `Bearer ${token}` : undefined);
      if (!isStaff(actor)) {
        await client.join(rooms.customer(actor.id));
        return;
      }
      const joined = [rooms.staff(actor.id), rooms.allStaff];
      if (actor.can(Permission.INBOX_SCOPE_DEPARTMENT))
        joined.push(rooms.department(actor.departmentId));
      if (actor.can(Permission.INBOX_SCOPE_ALL)) joined.push(rooms.all);
      await client.join(joined);
    } catch (e) {
      this.logger.debug(`socket rejected: ${(e as Error).message}`);
      client.emit('auth.error', { code: 'auth.unauthenticated' });
      client.disconnect(true);
    }
  }
}
