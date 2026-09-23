import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RealtimePublisher, rooms } from '../../common/realtime/realtime.publisher';
import { CreateProductDto, ProductDto, ProductSettingsDto, UpdateProductDto } from './catalog.dto';
import { Product } from './product.entity';
import { ProductRepository } from './product.repository';

/**
 * The product catalogue. Read paths (search, one product) are what customers and agents use; the
 * write paths belong to Settings › Products and need `SETTINGS_PRODUCT_MANAGE`.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly products: ProductRepository,
    private readonly realtime: RealtimePublisher,
  ) {}

  async search(q: string): Promise<ProductDto[]> {
    return (await this.products.search(q)).map(ProductDto.from);
  }

  async getById(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundException('product.notFound');
    return product;
  }

  async getOne(id: string): Promise<ProductDto> {
    return ProductDto.from(await this.getById(id));
  }

  async listForSettings(): Promise<ProductSettingsDto[]> {
    const rows = await this.products.listForSettings();
    return rows.map(({ product, enquiries }) => ({
      ...ProductDto.from(product),
      isActive: product.isActive,
      enquiries,
    }));
  }

  async create(dto: CreateProductDto): Promise<ProductSettingsDto> {
    const code = dto.code.trim().toUpperCase();
    if (await this.products.findByCode(code)) throw new ConflictException('product.duplicateCode');

    const product = this.products.create({
      code,
      name: dto.name.trim(),
      category: dto.category?.trim() || null,
      brand: dto.brand?.trim() || null,
      packSize: dto.packSize?.trim() || null,
      unit: dto.unit?.trim() || null,
      isActive: true,
    });
    return this.saved(await this.persist(product), 0);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductSettingsDto> {
    const product = await this.getById(id);

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.products.findByCode(code);
      if (clash && clash.id !== id) throw new ConflictException('product.duplicateCode');
      product.code = code;
    }
    if (dto.name !== undefined) product.name = dto.name.trim();
    if (dto.category !== undefined) product.category = dto.category.trim() || null;
    if (dto.brand !== undefined) product.brand = dto.brand.trim() || null;
    if (dto.packSize !== undefined) product.packSize = dto.packSize.trim() || null;
    if (dto.unit !== undefined) product.unit = dto.unit.trim() || null;
    // deactivate rather than delete: the product disappears from the pickers but old enquiries keep it
    if (dto.isActive !== undefined) product.isActive = dto.isActive;

    const saved = await this.persist(product);
    const row = (await this.products.listForSettings()).find((r) => r.product.id === id);
    return this.saved(saved, row?.enquiries ?? 0);
  }

  /** The unique index is the real guard — two requests can pass the findByCode check at once. */
  private async persist(product: Product): Promise<Product> {
    try {
      return await this.products.save(product);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('product.duplicateCode');
      }
      throw e;
    }
  }

  private saved(product: Product, enquiries: number): ProductSettingsDto {
    const dto = { ...ProductDto.from(product), isActive: product.isActive, enquiries };
    this.realtime.emit('product.updated', [rooms.allStaff], {
      entity: 'product',
      id: product.id,
      action: 'updated',
      data: dto,
    });
    return dto;
  }
}
