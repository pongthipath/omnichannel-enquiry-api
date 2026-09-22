import { MigrationInterface, QueryRunner } from 'typeorm';

/** pg_trgm powers product/customer/message search (design §16.10). */
export class EnableExtensions1758500000000 implements MigrationInterface {
  name = 'EnableExtensions1758500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS pgcrypto');
    await queryRunner.query('DROP EXTENSION IF EXISTS pg_trgm');
  }
}
