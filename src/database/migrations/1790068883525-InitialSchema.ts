import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790068883525 implements MigrationInterface {
  name = 'InitialSchema1790068883525';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(40) NOT NULL, "name" character varying(200) NOT NULL, "category" character varying(80), "brand" character varying(80), "pack_size" character varying(40), "unit" character varying(20), "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_product__code" UNIQUE ("code"), CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "department" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(40) NOT NULL, "name_th" character varying(120) NOT NULL, "name_en" character varying(120) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "uq_department__code" UNIQUE ("code"), CONSTRAINT "PK_9a2213262c1593bffb581e382f5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_department__is_default" ON "department" ("is_default") WHERE is_default`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff_role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(40) NOT NULL, "name" character varying(120) NOT NULL, "permissions" bigint NOT NULL DEFAULT '0', "is_system" boolean NOT NULL DEFAULT false, CONSTRAINT "uq_staff_role__code" UNIQUE ("code"), CONSTRAINT "PK_c3fe01125c99573751fe5e55666" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(200) NOT NULL, "password_hash" character varying(255) NOT NULL, "name" character varying(120) NOT NULL, "role_id" uuid NOT NULL, "department_id" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "ui_preferences" jsonb NOT NULL DEFAULT '{}', "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_staff__email" UNIQUE ("email"), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_staff__department_id" ON "staff" ("department_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customer" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(30) NOT NULL, "company_name" character varying(200) NOT NULL, "contact_name" character varying(120), "phone" character varying(30), "email" character varying(200), "password_hash" character varying(255), "salesperson_staff_id" uuid, "is_placeholder" boolean NOT NULL DEFAULT false, "internal_note" text, "version" integer NOT NULL, "last_contact_at" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_customer__email" UNIQUE ("email"), CONSTRAINT "uq_customer__code" UNIQUE ("code"), CONSTRAINT "PK_a7a13f4cacb744524e44dfdad32" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reference" character varying(20) NOT NULL, "customer_id" uuid NOT NULL, "client_request_id" uuid, "assigned_staff_id" uuid, "department_id" uuid NOT NULL, "product_id" uuid, "origin_channel" character varying(20) NOT NULL, "enquiry_type" character varying(30) NOT NULL, "enquiry_sub_type" character varying(60), "subject" character varying(200) NOT NULL, "description" text NOT NULL, "priority" character varying(10) NOT NULL, "status" character varying(30) NOT NULL, "sla_minutes" integer NOT NULL, "sla_due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "sla_paused_at" TIMESTAMP WITH TIME ZONE, "sla_paused_seconds" integer NOT NULL DEFAULT '0', "is_sla_breached" boolean NOT NULL DEFAULT false, "is_needs_review" boolean NOT NULL DEFAULT false, "reopen_count" integer NOT NULL DEFAULT '0', "last_reopened_at" TIMESTAMP WITH TIME ZONE, "escalated_at" TIMESTAMP WITH TIME ZONE, "first_response_at" TIMESTAMP WITH TIME ZONE, "resolved_at" TIMESTAMP WITH TIME ZONE, "last_message_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_message_preview" character varying(140), "last_message_sender_type" character varying(10), "last_message_channel" character varying(20), "unread_by_staff_count" integer NOT NULL DEFAULT '0', "version" integer NOT NULL, CONSTRAINT "uq_chat__customer_id_client_request_id" UNIQUE ("customer_id", "client_request_id"), CONSTRAINT "uq_chat__reference" UNIQUE ("reference"), CONSTRAINT "PK_9d0b2ba74336710fd31154738a5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_chat__product_id" ON "chat" ("product_id") `);
    await queryRunner.query(
      `CREATE INDEX "idx_chat__customer_id_last_message_at" ON "chat" ("customer_id", "last_message_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat__department_id_status" ON "chat" ("department_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat__assigned_staff_id_status" ON "chat" ("assigned_staff_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat__status_last_message_at" ON "chat" ("status", "last_message_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_channel" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customer_id" uuid NOT NULL, "channel" character varying(20) NOT NULL, "external_id" character varying(200) NOT NULL, "display_name" character varying(200), "last_seen_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_customer_channel__channel_external_id" UNIQUE ("channel", "external_id"), CONSTRAINT "PK_fcf3a1faac2cfa7fb23d42f5e75" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "chat_message" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "chat_id" uuid NOT NULL, "client_message_id" uuid, "channel" character varying(20) NOT NULL, "external_message_id" character varying(200), "sender_type" character varying(10) NOT NULL, "sender_id" uuid, "message_type" character varying(10) NOT NULL, "body" text, "event_data" jsonb, "is_internal" boolean NOT NULL DEFAULT false, "delivered_at" TIMESTAMP WITH TIME ZONE, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_chat_message__channel_external_message_id" UNIQUE ("channel", "external_message_id"), CONSTRAINT "uq_chat_message__chat_id_client_message_id" UNIQUE ("chat_id", "client_message_id"), CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_message__chat_id_created_at" ON "chat_message" ("chat_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "sla_policy" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "enquiry_type" character varying(30), "priority" character varying(10), "target_minutes" integer NOT NULL, "is_pause_when_waiting" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_19c1aa9dd53b9fc80648ae034b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "fk_staff__role_id" FOREIGN KEY ("role_id") REFERENCES "staff_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff" ADD CONSTRAINT "fk_staff__department_id" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer" ADD CONSTRAINT "fk_customer__salesperson_staff_id" FOREIGN KEY ("salesperson_staff_id") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "fk_chat__customer_id" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "fk_chat__assigned_staff_id" FOREIGN KEY ("assigned_staff_id") REFERENCES "staff"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "fk_chat__department_id" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat" ADD CONSTRAINT "fk_chat__product_id" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_channel" ADD CONSTRAINT "fk_customer_channel__customer_id" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_message" ADD CONSTRAINT "fk_chat_message__chat_id" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_message" DROP CONSTRAINT "fk_chat_message__chat_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_channel" DROP CONSTRAINT "fk_customer_channel__customer_id"`,
    );
    await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "fk_chat__product_id"`);
    await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "fk_chat__department_id"`);
    await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "fk_chat__assigned_staff_id"`);
    await queryRunner.query(`ALTER TABLE "chat" DROP CONSTRAINT "fk_chat__customer_id"`);
    await queryRunner.query(
      `ALTER TABLE "customer" DROP CONSTRAINT "fk_customer__salesperson_staff_id"`,
    );
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "fk_staff__department_id"`);
    await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "fk_staff__role_id"`);
    await queryRunner.query(`DROP TABLE "sla_policy"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat_message__chat_id_created_at"`);
    await queryRunner.query(`DROP TABLE "chat_message"`);
    await queryRunner.query(`DROP TABLE "customer_channel"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat__status_last_message_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat__assigned_staff_id_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat__department_id_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat__customer_id_last_message_at"`);
    await queryRunner.query(`DROP INDEX "public"."idx_chat__product_id"`);
    await queryRunner.query(`DROP TABLE "chat"`);
    await queryRunner.query(`DROP TABLE "customer"`);
    await queryRunner.query(`DROP INDEX "public"."idx_staff__department_id"`);
    await queryRunner.query(`DROP TABLE "staff"`);
    await queryRunner.query(`DROP TABLE "staff_role"`);
    await queryRunner.query(`DROP INDEX "public"."uq_department__is_default"`);
    await queryRunner.query(`DROP TABLE "department"`);
    await queryRunner.query(`DROP TABLE "product"`);
  }
}
