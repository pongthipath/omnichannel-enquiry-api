import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttachments1790130232891 implements MigrationInterface {
    name = 'AddAttachments1790130232891'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_message_attachment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "chat_message_id" uuid, "kind" character varying(10) NOT NULL, "file_name" character varying(200) NOT NULL, "mime_type" character varying(100) NOT NULL, "size_bytes" integer NOT NULL DEFAULT '0', "source_url" character varying(1000), "storage_key" character varying(300), "status" character varying(10) NOT NULL DEFAULT 'PENDING', "mirror_attempts" integer NOT NULL DEFAULT '0', "last_error" character varying(300), "uploaded_by_id" uuid, CONSTRAINT "PK_cd6b0ac809534d22f35b31e372f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_chat_message_attachment__status" ON "chat_message_attachment" ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_chat_message_attachment__message_id" ON "chat_message_attachment" ("chat_message_id") `);
        await queryRunner.query(`ALTER TABLE "chat_message_attachment" ADD CONSTRAINT "fk_chat_message_attachment__chat_message_id" FOREIGN KEY ("chat_message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_attachment" DROP CONSTRAINT "fk_chat_message_attachment__chat_message_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chat_message_attachment__message_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chat_message_attachment__status"`);
        await queryRunner.query(`DROP TABLE "chat_message_attachment"`);
    }

}
