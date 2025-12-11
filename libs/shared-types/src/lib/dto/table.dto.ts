import {
  IsString,
  IsArray,
  IsOptional,
  IsBoolean,
  IsObject,
  ValidateNested,
  Length,
  Matches,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FieldTypeEnum {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  CHOICE = 'choice',
  REFERENCE = 'reference',
}

export class FieldDefinitionDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Field name must be a valid identifier (start with letter or underscore, contain only alphanumeric and underscore)',
  })
  name!: string;

  @IsString()
  @Length(1, 255)
  label!: string;

  @IsEnum(FieldTypeEnum)
  type!: FieldTypeEnum;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsBoolean()
  @IsOptional()
  isUnique?: boolean;

  @IsBoolean()
  @IsOptional()
  isIndexed?: boolean;

  @IsOptional()
  defaultValue?: unknown;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  options?: string[];

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  storagePath?: string;
}

export class CreateTableDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Table name must be a valid identifier',
  })
  name!: string;

  @IsString()
  @Length(1, 255)
  @IsOptional()
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  storageTable?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  @ArrayMinSize(1, { message: 'At least one field is required' })
  fields!: FieldDefinitionDto[];
}

export class UpdateTableDto {
  @IsString()
  @Length(1, 255)
  @IsOptional()
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  @IsOptional()
  fields?: FieldDefinitionDto[];
}

export class TableNameParamDto {
  @IsString()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: 'Table name must be a valid identifier',
  })
  name!: string;
}
