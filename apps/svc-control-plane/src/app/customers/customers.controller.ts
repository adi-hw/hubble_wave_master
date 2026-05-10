import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryParams } from './customers.dto';
import { CustomerSettingsDto } from './customer-settings.dto';
import { Roles } from '../../../../control-plane/src/app/auth/roles.decorator';

@Controller('customers')
@Roles('operator')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(@Query() query: CustomerQueryParams) {
    return this.customersService.findAll(query);
  }

  @Get('stats')
  async getStats() {
    return this.customersService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.customersService.findByCode(code);
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }

  @Patch(':id/settings')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() settings: CustomerSettingsDto,
  ) {
    return this.customersService.updateSettings(id, settings);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.delete(id);
  }
}
