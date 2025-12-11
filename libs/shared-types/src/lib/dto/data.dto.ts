import { IsObject, IsOptional, IsUUID, IsString, IsArray, ArrayMinSize } from 'class-validator';
import { PaginationDto } from './pagination.dto';

export class CreateRecordDto {
  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateRecordDto {
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}

export class ListRecordsDto extends PaginationDto {
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}

export class TableParamDto {
  @IsString()
  table!: string;
}

export class RecordIdParamDto {
  @IsString()
  table!: string;

  @IsUUID()
  id!: string;
}

/**
 * DTO for bulk update operations
 */
export class BulkUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  ids!: (string | number)[];

  @IsObject()
  updates!: Record<string, unknown>;
}

/**
 * DTO for bulk delete operations
 */
export class BulkDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  ids!: (string | number)[];
}
