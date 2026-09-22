import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Actor, isStaff } from '../../../common/auth/actor';
import { UserType } from '../../../common/constants/enums';
import { RedisService } from '../../../common/redis/redis.service';
import { CustomerService } from '../../customer/customer.service';
import { StaffService } from '../../staff/profile/staff.service';
import { LoginDto, MeDto } from './auth.dto';
import { TokenPair, TokenService } from './token.service';

interface LoginAccount {
  id: string;
  passwordHash: string;
  active: boolean;
  touch: () => Promise<void>;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  /**
   * Verifying against a real hash when the account doesn't exist keeps the response time the same
   * for unknown emails and wrong passwords (no account enumeration).
   */
  private readonly dummyHash = argon2.hash(randomUUID(), { type: argon2.argon2id });

  constructor(
    private readonly staff: StaffService,
    private readonly customers: CustomerService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
  ) {}

  async login(dto: LoginDto): Promise<TokenPair> {
    const lockKey = `login-fail:${dto.userType}:${dto.email.toLowerCase()}`;
    const failures = Number((await this.redis.client.get(lockKey)) ?? 0);
    if (failures >= MAX_FAILED_ATTEMPTS) {
      throw new HttpException('auth.locked', HttpStatus.TOO_MANY_REQUESTS);
    }

    const account = await this.findAccount(dto);
    const hash = account?.passwordHash ?? (await this.dummyHash);
    const valid = await argon2.verify(hash, dto.password).catch(() => false);
    if (!account || !valid) {
      await this.redis.incrWithTtl(lockKey, LOCK_WINDOW_SECONDS);
      throw new UnauthorizedException('auth.invalidCredentials');
    }
    if (!account.active) throw new UnauthorizedException('auth.disabled');

    await this.redis.del(lockKey);
    await account.touch();
    return this.tokens.issue({ sub: account.id, typ: dto.userType });
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  async me(actor: Actor): Promise<MeDto> {
    if (isStaff(actor)) {
      return {
        id: actor.id,
        userType: UserType.STAFF,
        name: actor.name,
        permissions: actor.mask.toString(),
        departmentId: actor.departmentId,
      };
    }
    const customer = await this.customers.getById(actor.id);
    return {
      id: customer.id,
      userType: UserType.CUSTOMER,
      name: customer.contactName ?? customer.companyName,
      permissions: '0',
      departmentId: null,
    };
  }

  private async findAccount(dto: LoginDto): Promise<LoginAccount | null> {
    if (dto.userType === UserType.STAFF) {
      const s = await this.staff.findForLogin(dto.email);
      if (!s) return null;
      return {
        id: s.id,
        passwordHash: s.passwordHash,
        active: s.isActive,
        touch: () => this.staff.touchLogin(s.id),
      };
    }
    const c = await this.customers.findForLogin(dto.email);
    if (!c?.passwordHash) return null; // customers created from a channel have no app account
    return {
      id: c.id,
      passwordHash: c.passwordHash,
      active: true,
      touch: () => this.customers.touchLogin(c.id),
    };
  }
}
