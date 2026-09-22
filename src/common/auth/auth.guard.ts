import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserType } from '../constants/enums';
import { Permission } from '../permissions/permission.enum';
import { Actor, isStaff } from './actor';
import { ACTOR_RESOLVER, ActorResolver, JwtPayload } from './actor-resolver';
import { IS_PUBLIC, REQUIRED_PERMISSIONS } from './auth.decorators';

/**
 * Global guard: verifies the bearer JWT, attaches `request.actor`, then checks @RequirePermission bits.
 * Staff permissions are re-read (cached) on every request, so role changes apply immediately — the JWT only
 * carries the user id and type.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ACTOR_RESOLVER) private readonly actors: ActorResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = ctx.switchToHttp().getRequest();
    const actor = await this.authenticate(request.headers.authorization);
    request.actor = actor;

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, targets);
    if (required?.length) {
      if (!isStaff(actor) || !required.every((p) => actor.can(p))) {
        throw new ForbiddenException('auth.forbidden');
      }
    }
    return true;
  }

  async authenticate(authorization?: string): Promise<Actor> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) throw new UnauthorizedException('auth.unauthenticated');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('auth.tokenExpired');
    }

    if (payload.typ === 'customer') return { type: UserType.CUSTOMER, id: payload.sub };
    const staff = await this.actors.resolveStaff(payload.sub);
    if (!staff) throw new UnauthorizedException('auth.disabled');
    return staff;
  }
}
