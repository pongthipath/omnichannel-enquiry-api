import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Product } from './product.entity';

/** Must match the expression of idx_product__search_trgm exactly, or Postgres won't use the index. */
export const PRODUCT_SEARCH_EXPR =
  "lower(product.code || ' ' || product.name || ' ' || coalesce(product.brand, '') || ' ' || coalesce(product.category, ''))";

/**
 * word_similarity threshold for product typos. Measured: "mozarela" vs the Mozzarella product = 0.545,
 * unrelated cheeses ≤ 0.11 — Postgres' default 0.6 would miss it, 0.5 separates cleanly.
 */
const PRODUCT_WORD_SIMILARITY = 0.5;

@Injectable()
export class ProductRepository {
  constructor(@InjectRepository(Product) private readonly repo: Repository<Product>) {}

  /**
   * Partial match (LIKE) + typo tolerance, exact code first (design §16.10).
   * The indexed text joins code + name + brand + category, so it is long: whole-string similarity() stays
   * low for a one-word query. word_similarity (<%) scores the best-matching part of the text instead.
   * Trigram needs ≥ 3 characters; 2 characters = code prefix only.
   */
  async search(q: string, limit = 20): Promise<Product[]> {
    const term = q.trim().toLowerCase();

    if (term.length < 3) {
      return this.repo
        .createQueryBuilder('product')
        .where('product.isActive = true')
        .andWhere('lower(product.code) LIKE :prefix', { prefix: `${term}%` })
        .orderBy('product.code')
        .take(limit)
        .getMany();
    }

    // SET LOCAL only lasts for this transaction — other queries keep the default threshold
    return this.repo.manager.transaction(async (m) => {
      await m.query(`SET LOCAL pg_trgm.word_similarity_threshold = ${PRODUCT_WORD_SIMILARITY}`);
      return m
        .getRepository(Product)
        .createQueryBuilder('product')
        .where('product.isActive = true')
        .andWhere(`(${PRODUCT_SEARCH_EXPR} LIKE :like OR :term <% ${PRODUCT_SEARCH_EXPR})`, {
          like: `%${term}%`,
          term,
        })
        .orderBy(`(lower(product.code) = :term)`, 'DESC')
        .addOrderBy(`word_similarity(:term, ${PRODUCT_SEARCH_EXPR})`, 'DESC')
        .setParameter('term', term)
        .limit(limit)
        .getMany();
    });
  }

  findById(id: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Product | null> {
    return this.repo.findOne({ where: { code } });
  }

  /**
   * The management page, unlike the picker: inactive products are shown too (they still appear on old
   * enquiries), with how many enquiries mention each one so nobody deactivates something in daily use.
   */
  async listForSettings(): Promise<{ product: Product; enquiries: number }[]> {
    const rows = await this.repo
      .createQueryBuilder('product')
      .leftJoin('chat', 'chat', 'chat.product_id = product.id')
      .select('product')
      .addSelect('COUNT(chat.id)', 'enquiries')
      .groupBy('product.id')
      .orderBy('product.code')
      .getRawAndEntities();
    return rows.entities.map((product, i) => ({
      product,
      enquiries: Number(rows.raw[i]?.enquiries ?? 0),
    }));
  }

  create(input: DeepPartial<Product>): Product {
    return this.repo.create(input);
  }

  save(product: Product): Promise<Product> {
    return this.repo.save(product);
  }
}
