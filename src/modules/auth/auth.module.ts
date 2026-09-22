import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { StaffModule } from '../staff/staff.module';
import { AuthController } from './login/auth.controller';
import { AuthService } from './login/auth.service';
import { TokenService } from './login/token.service';

@Module({
  imports: [StaffModule, CustomerModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService],
})
export class AuthModule {}
