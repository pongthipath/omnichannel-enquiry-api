import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { StaffActor } from '../../../common/auth/actor';
import { Channel, ChatStatus as S, Priority } from '../../../common/constants/enums';
import { DepartmentService } from '../../staff/department/department.service';
import { StaffService } from '../../staff/profile/staff.service';
import { ChatAccessPolicy } from '../enquiry/chat-access.policy';
import { Chat } from '../enquiry/chat.entity';
import { EnquiryService } from '../enquiry/enquiry.service';
import { DashboardSummaryDto } from './dashboard.dto';

const DONE = [S.RESOLVED, S.CLOSED];
const URGENT_LIMIT = 5;

/**
 * Numbers for the dashboard, always inside what the viewer may see (same ChatAccessPolicy as the
 * inbox) — an agent's dashboard counts their department only, a manager's counts everything.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Chat) private readonly repo: Repository<Chat>,
    private readonly enquiries: EnquiryService,
    private readonly staff: StaffService,
    private readonly departments: DepartmentService,
  ) {}

  async summary(actor: StaffActor, days?: number): Promise<DashboardSummaryDto> {
    const since = days ? new Date(Date.now() - days * 86_400_000) : null;
    const scoped = () => {
      const qb = this.repo.createQueryBuilder('chat');
      ChatAccessPolicy.applyScope(qb, 'chat', actor);
      if (since) qb.andWhere('chat.createdAt >= :since', { since });
      return qb;
    };
    const open = (qb: SelectQueryBuilder<Chat>) => qb.andWhere('chat.status NOT IN (:...done)', { done: DONE });
    const count = (qb: SelectQueryBuilder<Chat>) => qb.getCount();

    const [byStatusRaw, byDeptRaw, byChannelRaw, teamRaw, totals, urgentRows] = await Promise.all([
      scoped().select('chat.status', 'key').addSelect('COUNT(*)::int', 'n').groupBy('chat.status').getRawMany(),
      open(scoped()).select('chat.departmentId', 'key').addSelect('COUNT(*)::int', 'n').groupBy('chat.departmentId').getRawMany(),
      scoped().select('chat.originChannel', 'key').addSelect('COUNT(*)::int', 'n').groupBy('chat.originChannel').getRawMany(),
      open(scoped())
        .select('chat.assignedStaffId', 'key')
        .addSelect('COUNT(*)::int', 'n')
        .addSelect(`COUNT(*) FILTER (WHERE chat.status = '${S.WAITING_FOR_CUSTOMER}')::int`, 'waiting')
        .groupBy('chat.assignedStaffId')
        .getRawMany(),
      Promise.all([
        count(open(scoped())),
        count(open(scoped()).andWhere('chat.assignedStaffId IS NULL')),
        count(open(scoped()).andWhere('chat.isSlaBreached = true')),
        count(open(scoped()).andWhere('chat.reopenCount > 0')),
        count(scoped().andWhere('chat.status = :w', { w: S.WAITING_FOR_CUSTOMER })),
        scoped()
          .select(`AVG(EXTRACT(EPOCH FROM (chat.firstResponseAt - chat.createdAt)) / 60)`, 'avg')
          .andWhere('chat.firstResponseAt IS NOT NULL')
          .getRawOne<{ avg: string | null }>(),
      ]),
      open(scoped())
        .andWhere('(chat.isSlaBreached = true OR chat.priority = :urgent OR chat.reopenCount > 0)', {
          urgent: Priority.URGENT,
        })
        .orderBy('chat.isSlaBreached', 'DESC')
        .addOrderBy(`(chat.priority = '${Priority.URGENT}')`, 'DESC')
        .addOrderBy('chat.slaDueAt', 'ASC')
        .take(URGENT_LIMIT)
        .getMany(),
    ]);

    const staff = await this.staff.findByIds(teamRaw.map((r) => r.key).filter(Boolean));
    const depts = await this.departments.findByIds([
      ...new Set([...byDeptRaw.map((r) => r.key as string), ...staff.map((s) => s.departmentId)]),
    ]);
    const deptName = new Map(depts.map((d) => [d.id, d.nameTh]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const [notClosed, unassigned, slaBreached, reopened, waitingForCustomer, avg] = totals;

    return {
      totals: {
        notClosed,
        unassigned,
        slaBreached,
        reopened,
        waitingForCustomer,
        avgFirstResponseMinutes: avg?.avg == null ? null : Math.round(Number(avg.avg)),
      },
      byStatus: Object.values(S).map((status) => ({
        status,
        count: byStatusRaw.find((r) => r.key === status)?.n ?? 0,
      })),
      byDepartment: byDeptRaw
        .map((r) => ({ departmentId: r.key, name: deptName.get(r.key) ?? '—', count: r.n }))
        .sort((a, b) => b.count - a.count),
      byChannel: byChannelRaw
        .map((r) => ({ channel: r.key as Channel, count: r.n }))
        .sort((a, b) => b.count - a.count),
      team: teamRaw
        .map((r) => {
          const s = r.key ? staffById.get(r.key) : undefined;
          return {
            staffId: r.key ?? null,
            name: s?.name ?? 'ยังไม่มอบหมาย',
            departmentName: s ? (deptName.get(s.departmentId) ?? null) : null,
            active: r.n,
            waiting: r.waiting,
          };
        })
        .sort((a, b) => (a.staffId === null ? 1 : b.staffId === null ? -1 : b.active - a.active)),
      urgent: await this.enquiries.toDtos(actor, urgentRows),
    };
  }
}
