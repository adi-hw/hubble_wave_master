import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from '../../../control-plane/src/app/auth/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData() {
    return this.appService.getData();
  }
}
