import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written: TypeORM cannot generate expression/trigram indexes or sequences.
 * - trigram indexes for product / customer / message search (design §16.10)
 * - sequence behind human-readable enquiry references (ENQ-2026-000123)
 */
export class SearchIndexesAndReferenceSequence1790068900000 implements MigrationInterface {
  name = 'SearchIndexesAndReferenceSequence1790068900000';

  public async up(q: QueryRunner): Promise<void> {
    // must match PRODUCT_SEARCH_EXPR in ProductRepository exactly
    await q.query(`
      CREATE INDEX "idx_product__search_trgm" ON "product" USING GIN (
        (lower(code || ' ' || name || ' ' || coalesce(brand, '') || ' ' || coalesce(category, ''))) gin_trgm_ops
      )`);
    await q.query(
      `CREATE INDEX "idx_product__code_prefix" ON "product" (lower(code) text_pattern_ops)`,
    );
    await q.query(
      `CREATE INDEX "idx_customer__company_name_trgm" ON "customer" USING GIN (company_name gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX "idx_customer__contact_name_trgm" ON "customer" USING GIN (contact_name gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX "idx_customer__phone_trgm" ON "customer" USING GIN (phone gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX "idx_customer__email_trgm" ON "customer" USING GIN (email gin_trgm_ops)`,
    );
    await q.query(
      `CREATE INDEX "idx_customer_channel__display_name_trgm" ON "customer_channel" USING GIN (display_name gin_trgm_ops)`,
    );
    await q.query(`
      CREATE INDEX "idx_chat_message__body_trgm" ON "chat_message" USING GIN (body gin_trgm_ops)
      WHERE message_type <> 'EVENT'`);
    await q.query(`CREATE SEQUENCE IF NOT EXISTS "chat_reference_seq" START 1`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP SEQUENCE IF EXISTS "chat_reference_seq"`);
    for (const idx of [
      'idx_chat_message__body_trgm',
      'idx_customer_channel__display_name_trgm',
      'idx_customer__email_trgm',
      'idx_customer__phone_trgm',
      'idx_customer__contact_name_trgm',
      'idx_customer__company_name_trgm',
      'idx_product__code_prefix',
      'idx_product__search_trgm',
    ]) {
      await q.query(`DROP INDEX IF EXISTS "${idx}"`);
    }
  }
}
