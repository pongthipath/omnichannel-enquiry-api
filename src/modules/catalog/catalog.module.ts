import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Product } from './product.entity';
import { ProductRepository } from './product.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [CatalogController],
  providers: [ProductRepository, CatalogService],
  exports: [ProductRepository, CatalogService],
})
export class CatalogModule {}
