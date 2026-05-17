import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AuthenticatedOnly } from './auth/authenticated-only.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @AuthenticatedOnly()
  getData() {
    return this.appService.getData();
  }
}
