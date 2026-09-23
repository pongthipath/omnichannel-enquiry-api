import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../../common/auth/auth.decorators';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
import { Permission } from '../../common/permissions/permission.enum';
import {
  CreateProductDto,
  ProductDto,
  ProductSettingsDto,
  SearchProductsQuery,
  UpdateProductDto,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @ApiOperation({ summary: 'Search products (customers and staff) — active products only' })
  @ApiOkResponse({ type: [ProductDto] })
  search(@Query() query: SearchProductsQuery): Promise<ProductDto[]> {
    return this.catalog.search(query.q ?? '');
  }

  // before products/:id, or "settings" would be read as an id
  @Get('settings/products')
  @RequirePermission(Permission.SETTINGS_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'All products incl. inactive, with the number of enquiries about each' })
  @ApiOkResponse({ type: [ProductSettingsDto] })
  listForSettings(): Promise<ProductSettingsDto[]> {
    return this.catalog.listForSettings();
  }

  @Post('products')
  @RequirePermission(Permission.SETTINGS_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Add a product to the catalogue' })
  @ApiCreatedResponse({ type: ProductSettingsDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'product.duplicateCode' })
  create(@Body() dto: CreateProductDto): Promise<ProductSettingsDto> {
    return this.catalog.create(dto);
  }

  @Patch('products/:id')
  @RequirePermission(Permission.SETTINGS_PRODUCT_MANAGE)
  @ApiOperation({ summary: 'Edit a product, or switch it off so it leaves the pickers' })
  @ApiOkResponse({ type: ProductSettingsDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'product.duplicateCode' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductSettingsDto> {
    return this.catalog.update(id, dto);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'One product (enquiry detail panel)' })
  @ApiOkResponse({ type: ProductDto })
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductDto> {
    return this.catalog.getOne(id);
  }
}
