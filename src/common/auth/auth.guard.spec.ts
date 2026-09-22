import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserType } from '../constants/enums';
import { Permission } from '../permissions/permission.enum';
import { toMask } from '../permissions/permission-mask.util';
import { StaffActor } from './actor';
import { ActorResolver } from './actor-resolver';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
  const actors: ActorResolver = { resolveStaff: jest.fn() };
  const guard = new AuthGuard(reflector, jwt, actors);

  const ctx = (authorization?: string) => {
    const request: Record<string, unknown> = { headers: { authorization } };
    return {
      request,
      context: {
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };
  const meta = (isPublic: boolean, required?: Permission[]) =>
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === 'isPublic' ? isPublic : required,
    );
  const staff = (permissions: Permission[]) =>
    new StaffActor('s1', 'dept-cs', 'role-1', 'Suda', toMask(permissions));

  beforeEach(() => jest.clearAllMocks());

  it('route ที่เป็น public ผ่านได้โดยไม่ต้องมี token', async () => {
    meta(true);
    await expect(guard.canActivate(ctx().context)).resolves.toBe(true);
  });

  it('ไม่มี token → 401', async () => {
    meta(false);
    await expect(guard.canActivate(ctx().context)).rejects.toThrow(UnauthorizedException);
  });

  it('token ของลูกค้า → actor เป็นลูกค้า', async () => {
    meta(false);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'c1', typ: 'customer' });
    const { context, request } = ctx('Bearer t');
    await guard.canActivate(context);
    expect(request.actor).toEqual({ type: UserType.CUSTOMER, id: 'c1' });
  });

  it('staff ที่ถูกปิดใช้งานแล้ว → 401 แม้ token ยังไม่หมดอายุ', async () => {
    meta(false);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 's1', typ: 'staff' });
    (actors.resolveStaff as jest.Mock).mockResolvedValue(null);
    await expect(guard.canActivate(ctx('Bearer t').context)).rejects.toThrow(UnauthorizedException);
  });

  it('staff ไม่มี bit ที่ route ต้องการ → 403', async () => {
    meta(false, [Permission.INBOX_ASSIGN_OTHERS]);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 's1', typ: 'staff' });
    (actors.resolveStaff as jest.Mock).mockResolvedValue(staff([Permission.INBOX_ASSIGN_SELF]));
    await expect(guard.canActivate(ctx('Bearer t').context)).rejects.toThrow(ForbiddenException);
  });

  it('ลูกค้าเรียก route ที่ต้องใช้สิทธิ์ staff → 403', async () => {
    meta(false, [Permission.INBOX_PAGE_VIEW]);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'c1', typ: 'customer' });
    await expect(guard.canActivate(ctx('Bearer t').context)).rejects.toThrow(ForbiddenException);
  });

  it('staff มีครบทุก bit → ผ่าน', async () => {
    meta(false, [Permission.INBOX_ASSIGN_OTHERS]);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 's1', typ: 'staff' });
    (actors.resolveStaff as jest.Mock).mockResolvedValue(staff([Permission.INBOX_ASSIGN_OTHERS]));
    await expect(guard.canActivate(ctx('Bearer t').context)).resolves.toBe(true);
  });
});
