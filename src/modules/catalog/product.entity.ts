import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** Search index idx_product__search_trgm is created in a hand-written migration (expression GIN index). */
@Entity('product')
@Unique('uq_product__code', ['code'])
export class Product extends BaseEntity {
  @Column({ length: 40 })
  code: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  packSize: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;

  @Column({ default: true })
  isActive: boolean;
}
