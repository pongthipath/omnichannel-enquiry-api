import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Product } from './product.entity';
import { ProductRepository } from './product.repository';

export class SearchProductsQuery {
  @ApiPropertyOptional({
    example: 'เนยจืด',
    description: 'code, name, brand or category — typos tolerated',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ProductDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'BTR-FR-250' }) code: string;
  @ApiProperty({ example: 'President เนยจืด 250g (French Butter)' }) name: string;
  @ApiPropertyOptional({ nullable: true }) category: string | null;
  @ApiPropertyOptional({ nullable: true }) brand: string | null;
  @ApiPropertyOptional({ nullable: true }) packSize: string | null;
  @ApiPropertyOptional({ nullable: true }) unit: string | null;

  static from(p: Product): ProductDto {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      brand: p.brand,
      packSize: p.packSize,
      unit: p.unit,
    };
  }
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class CatalogController {
  constructor(private readonly products: ProductRepository) {}

  @Get()
  @ApiOperation({ summary: 'Search products (customers and staff)' })
  @ApiOkResponse({ type: [ProductDto] })
  async search(@Query() query: SearchProductsQuery): Promise<ProductDto[]> {
    return (await this.products.search(query.q ?? '')).map(ProductDto.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One product (enquiry detail panel)' })
  @ApiOkResponse({ type: ProductDto })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDto> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundException('product.notFound');
    return ProductDto.from(product);
  }
}
