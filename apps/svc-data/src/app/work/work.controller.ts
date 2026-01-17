import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, RequestUser } from '@hubblewave/auth-guard';
import { QueryOptions } from '../collection-data.service';
import { AddWorkCommentRequest, TransitionWorkItemRequest, WorkService } from './work.service';

interface ListQueryDto {
  page?: string;
  pageSize?: string;
  sort?: string;
  filters?: string;
  search?: string;
  searchFields?: string;
  viewId?: string;
}

@Controller('work')
@UseGuards(JwtAuthGuard)
export class WorkController {
  constructor(private readonly work: WorkService) {}

  @Get('items')
  async list(@Query() query: ListQueryDto, @CurrentUser() user: RequestUser) {
    return this.work.list(user, this.parseQueryOptions(query));
  }

  @Get('items/:id')
  async get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.work.get(user, id);
  }

  @Post('items/:id/comment')
  async addComment(
    @Param('id') id: string,
    @Body() body: AddWorkCommentRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return this.work.addComment(user, id, body);
  }

  @Post('items/:id/transition')
  async transition(
    @Param('id') id: string,
    @Body() body: TransitionWorkItemRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return this.work.transition(user, id, body);
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
