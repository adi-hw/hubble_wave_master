import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { OfferingsService, SubmitOfferingRequest } from './offerings.service';
import { QueryOptions } from '../collection-data.service';

interface ListQueryDto {
  page?: string;
  pageSize?: string;
  sort?: string;
  filters?: string;
  search?: string;
  searchFields?: string;
  viewId?: string;
}

@Controller('offerings')
@UseGuards(JwtAuthGuard)
export class OfferingsController {
  constructor(private readonly offerings: OfferingsService) {}

  @Get()
  async list(@Query() query: ListQueryDto, @CurrentUser() user: RequestUser) {
    return this.offerings.list(user, this.parseQueryOptions(query));
  }

  @Post('submit')
  async submit(
    @Body() body: SubmitOfferingRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return this.offerings.submit(user, body);
  }

  private parseQueryOptions(query: ListQueryDto): QueryOptions {
    const options: QueryOptions = {};

    if (query.page) {
      options.page = parseInt(query.page, 10) || 1;
    }
    if (query.pageSize) {
      options.pageSize = parseInt(query.pageSize, 10) || 20;
    }
    if (query.viewId) {
      options.viewId = query.viewId;
    }
    if (query.search) {
      options.search = query.search;
    }
    if (query.searchFields) {
      options.searchProperties = query.searchFields.split(',').map((s) => s.trim());
    }

    if (query.sort) {
      try {
        options.sort = JSON.parse(query.sort);
      } catch {
        options.sort = query.sort.split(',').map((s) => {
          const [property, dir] = s.trim().split(':');
          return { property, direction: (dir?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
        });
      }
    }

    if (query.filters) {
      try {
        options.filters = JSON.parse(query.filters);
      } catch {
        // ignore invalid filters
      }
    }

    return options;
  }
}
