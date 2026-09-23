import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { toMask } from '../../common/permissions/permission-mask.util';
import dataSource from '../data-source';
import * as data from './seed-data';

/**
 * Idempotent: safe to run again (upserts by natural keys). Runs from `npm run seed`, and on every
 * boot in development so a fresh checkout has data without anyone remembering to seed it.
 */
export async function seed(ds: DataSource): Promise<void> {
  const q = ds.createQueryRunner();
  const passwordHash = await argon2.hash(data.DEV_PASSWORD, { type: argon2.argon2id });

  await q.startTransaction();
  try {
    for (const [i, d] of data.departments.entries()) {
      await q.query(
        `INSERT INTO department (code, name_th, name_en, is_default, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ON CONSTRAINT uq_department__code DO UPDATE SET name_th = EXCLUDED.name_th, name_en = EXCLUDED.name_en`,
        [d.code, d.nameTh, d.nameEn, Boolean(d.isDefault), i],
      );
    }

    for (const r of data.roles) {
      await q.query(
        `INSERT INTO staff_role (code, name, permissions, is_system) VALUES ($1, $2, $3, true)
         ON CONFLICT ON CONSTRAINT uq_staff_role__code DO UPDATE SET permissions = EXCLUDED.permissions`,
        [r.code, r.name, toMask(r.permissions).toString()],
      );
    }

    for (const s of data.staff) {
      await q.query(
        `INSERT INTO staff (email, password_hash, name, role_id, department_id)
         VALUES ($1, $2, $3, (SELECT id FROM staff_role WHERE code = $4), (SELECT id FROM department WHERE code = $5))
         ON CONFLICT ON CONSTRAINT uq_staff__email DO NOTHING`,
        [s.email, passwordHash, s.name, s.role, s.department],
      );
    }

    for (const c of data.customers) {
      const [row] = await q.query(
        `INSERT INTO customer (code, company_name, contact_name, phone, email, password_hash, salesperson_staff_id)
         VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM staff WHERE email = $7))
         ON CONFLICT ON CONSTRAINT uq_customer__code DO UPDATE SET company_name = EXCLUDED.company_name
         RETURNING id`,
        [c.code, c.companyName, c.contactName, c.phone, c.email, passwordHash, c.salesperson],
      );
      await q.query(
        `INSERT INTO customer_channel (customer_id, channel, external_id, display_name) VALUES ($1, 'MOBILE_APP', $2, $3)
         ON CONFLICT ON CONSTRAINT uq_customer_channel__channel_external_id DO NOTHING`,
        [row.id, c.email, c.contactName],
      );
      for (const ch of c.channels) {
        await q.query(
          `INSERT INTO customer_channel (customer_id, channel, external_id, display_name) VALUES ($1, $2, $3, $4)
           ON CONFLICT ON CONSTRAINT uq_customer_channel__channel_external_id DO NOTHING`,
          [row.id, ch.channel, ch.externalId, ch.displayName],
        );
      }
    }

    for (const [code, name, category, brand, packSize, unit] of data.products) {
      await q.query(
        `INSERT INTO product (code, name, category, brand, pack_size, unit) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ON CONSTRAINT uq_product__code DO UPDATE SET name = EXCLUDED.name`,
        [code, name, category, brand, packSize, unit],
      );
    }

    const [{ count }] = await q.query(`SELECT count(*)::int AS count FROM sla_policy`);
    if (count === 0) {
      for (const p of data.slaPolicies) {
        await q.query(
          `INSERT INTO sla_policy (enquiry_type, priority, target_minutes) VALUES ($1, $2, $3)`,
          [p.enquiryType, p.priority, p.targetMinutes],
        );
      }
    }

    await q.commitTransaction();
  } catch (e) {
    await q.rollbackTransaction();
    throw e;
  } finally {
    await q.release();
  }
}

if (require.main === module) {
  void dataSource
    .initialize()
    .then(() => seed(dataSource))
    .then(() => console.log(`seeded — login with any seeded email and password "${data.DEV_PASSWORD}"`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => dataSource.destroy());
}
