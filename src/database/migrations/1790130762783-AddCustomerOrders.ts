import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerOrders1790130762783 implements MigrationInterface {
    name = 'AddCustomerOrders1790130762783'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "customer_order" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "customer_id" uuid NOT NULL, "order_no" character varying(40) NOT NULL, "ordered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying(20) NOT NULL, "total_amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'THB', "items_summary" character varying(300), "delivered_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_customer_order__order_no" UNIQUE ("order_no"), CONSTRAINT "PK_c70aef746523b2c4a0af0945209" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_customer_order__customer_id_ordered_at" ON "customer_order" ("customer_id", "ordered_at") `);
        await queryRunner.query(`ALTER TABLE "customer_order" ADD CONSTRAINT "fk_customer_order__customer_id" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customer_order" DROP CONSTRAINT "fk_customer_order__customer_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_customer_order__customer_id_ordered_at"`);
        await queryRunner.query(`DROP TABLE "customer_order"`);
    }

}
