import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { JwtPayload } from '../../../common/auth/actor-resolver';
import { RedisService } from '../../../common/redis/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshRecord extends JwtPayload {
  family: string;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const refreshKey = (token: string) => `refresh:${hash(token)}`;
const familyKey = (family: string) => `refresh-family:${family}`;

/**
 * Access token: short-lived JWT (memory only on the client).
 * Refresh token: random, stored hashed in Redis, rotated on every use. Reusing an already-rotated
 * token revokes the whole family (stolen-token detection, design §16.12).
 */
@Injectable()
export class TokenService {
  private readonly refreshTtl: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.refreshTtl = Number(config.get('REFRESH_TTL_DAYS', 30)) * 86_400;
  }

  async issue(payload: JwtPayload, family: string = randomUUID()): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: payload.sub, typ: payload.typ });
    const refreshToken = randomBytes(32).toString('base64url');
    const record: RefreshRecord = { ...payload, family };
    await this.redis.setJson(refreshKey(refreshToken), record, this.refreshTtl);
    // the family remembers its current token hash; anything else presented later is a reuse
    await this.redis.client.set(familyKey(family), hash(refreshToken), 'EX', this.refreshTtl);
    return { accessToken, refreshToken };
  }

  async rotate(refreshToken: string): Promise<TokenPair> {
    const record = await this.redis.getJson<RefreshRecord>(refreshKey(refreshToken));
    if (!record) throw new UnauthorizedException('auth.refreshInvalid');

    const current = await this.redis.client.get(familyKey(record.family));
    if (current !== hash(refreshToken)) {
      await this.revokeFamily(record.family);
      throw new UnauthorizedException('auth.refreshReused');
    }
    await this.redis.del(refreshKey(refreshToken));
    return this.issue({ sub: record.sub, typ: record.typ }, record.family);
  }

  async revoke(refreshToken: string): Promise<void> {
    const record = await this.redis.getJson<RefreshRecord>(refreshKey(refreshToken));
    await this.redis.del(refreshKey(refreshToken));
    if (record) await this.revokeFamily(record.family);
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.redis.del(familyKey(family));
  }
}
