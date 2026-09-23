import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Product } from './product.entity';

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

/** The settings list shows what the pickers hide: inactive products, and how often each is used. */
export class ProductSettingsDto extends ProductDto {
  @ApiProperty({ description: 'off = hidden from the pickers, old enquiries keep it' }) isActive: boolean;
  @ApiProperty({ description: 'enquiries that mention this product' }) enquiries: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'BTR-FR-250', description: 'stored upper-case, must be unique' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code: string;

  @ApiProperty({ example: 'President เนยจืด 250g (French Butter)' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'เนย' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'President' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiPropertyOptional({ example: '250g' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  packSize?: string;

  @ApiPropertyOptional({ example: 'ก้อน' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  packSize?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: 'off hides it from the pickers instead of deleting it' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
