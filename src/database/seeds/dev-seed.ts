import { INestApplicationContext, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { demoScenarios } from './demo-data';
import { seedDemo } from './demo-seed';
import { DEV_PASSWORD } from './seed-data';
import { seed } from './seed';

/**
 * Put the demo data in place on every boot in development, so a fresh checkout (or a database that
 * was just wiped) has accounts, products and enquiries without anyone having to remember the seed
 * commands. Both seeds upsert by natural key, so booting repeatedly changes nothing.
 *
 * Never runs outside development, and a failure only logs — a seeding problem must not stop the API.
 * Set `SEED_ON_BOOT=false` to skip it (handy when you are deliberately testing an empty database).
 */
export async function seedDevData(app: INestApplicationContext, logger: Logger): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;
  if (process.env.SEED_ON_BOOT === 'false') {
    logger.log('skipped (SEED_ON_BOOT=false)');
    return;
  }

  try {
    const dataSource = app.get(DataSource);
    await seed(dataSource);
    const created = await seedDemo(dataSource);
    logger.log(
      `ready — ${created} of ${demoScenarios.length} demo enquiries added, the rest were already there. ` +
        `Sign in with any seeded email and password "${DEV_PASSWORD}"`,
    );
  } catch (e) {
    // most likely the migrations have not been run yet; say so instead of crashing the server
    logger.warn(`skipped: ${(e as Error).message}. Run "npm run migration:run" then restart.`);
  }
}
