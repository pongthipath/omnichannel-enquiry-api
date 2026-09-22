import { MigrationInterface, QueryRunner } from 'typeorm';

/** Only version defaults. (Trigram indexes are hand-managed — see SearchIndexesAndReferenceSequence.) */
export class AddVersionDefaults1790068994456 implements MigrationInterface {
  name = 'AddVersionDefaults1790068994456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customer" ALTER COLUMN "version" SET DEFAULT '1'`);
    await queryRunner.query(`ALTER TABLE "chat" ALTER COLUMN "version" SET DEFAULT '1'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat" ALTER COLUMN "version" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "customer" ALTER COLUMN "version" DROP DEFAULT`);
  }
}
