import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTags1790088673745 implements MigrationInterface {
    name = 'AddTags1790088673745'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(60) NOT NULL, "color" character varying(20) NOT NULL DEFAULT 'blue', "applies_to" character varying(10) NOT NULL DEFAULT 'ENQUIRY', "description" character varying(300), "created_by_staff_id" uuid, CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id"))`);
        // hand-written: tag names are unique ignoring case (entity declares it with synchronize: false)
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_tag__name_lower" ON "tag" (lower(name))`);
        await queryRunner.query(`CREATE TABLE "chat_tag" ("chat_id" uuid NOT NULL, "tag_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "pk_chat_tag" PRIMARY KEY ("chat_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "idx_chat_tag__tag_id" ON "chat_tag" ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "chat_tag" ADD CONSTRAINT "fk_chat_tag__chat_id" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_tag" ADD CONSTRAINT "fk_chat_tag__tag_id" FOREIGN KEY ("tag_id") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_tag" DROP CONSTRAINT "fk_chat_tag__tag_id"`);
        await queryRunner.query(`ALTER TABLE "chat_tag" DROP CONSTRAINT "fk_chat_tag__chat_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chat_tag__tag_id"`);
        await queryRunner.query(`DROP TABLE "chat_tag"`);
        await queryRunner.query(`DROP INDEX "public"."uq_tag__name_lower"`);
        await queryRunner.query(`DROP TABLE "tag"`);
    }

}
