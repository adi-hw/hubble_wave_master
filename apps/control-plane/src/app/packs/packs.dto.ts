import { IsOptional, IsString, Matches, Length } from 'class-validator';

const RELEASE_ID_PATTERN = /^\d{8}\.\d{3,}$/;
const PACK_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export class PackUploadUrlDto {
  @IsString()
  @Length(3, 200)
  @Matches(PACK_CODE_PATTERN)
  code!: string;

  @IsString()
  @Matches(RELEASE_ID_PATTERN)
  releaseId!: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

export class PackRegisterDto {
  @IsString()
  artifactKey!: string;

  @IsOptional()
  @IsString()
  artifactBucket?: string;
}

export class PackDownloadUrlDto {
  @IsOptional()
  @IsString()
  expiresInSeconds?: string;
}

export class PackInstallDto {
  @IsString()
  instanceId!: string;

  @IsString()
  @Length(3, 200)
  @Matches(PACK_CODE_PATTERN)
  packCode!: string;

  @IsString()
  @Matches(RELEASE_ID_PATTERN)
  releaseId!: string;
}

export class PackInstallStatusDto {
  @IsString()
  instanceId!: string;

  @IsOptional()
  @IsString()
  @Length(3, 200)
  @Matches(PACK_CODE_PATTERN)
  packCode?: string;

  @IsOptional()
  @IsString()
  @Matches(RELEASE_ID_PATTERN)
  releaseId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class PackRollbackDto {
  @IsString()
  instanceId!: string;

  @IsString()
  @Length(3, 200)
  @Matches(PACK_CODE_PATTERN)
  packCode!: string;

  @IsString()
  @Matches(RELEASE_ID_PATTERN)
  releaseId!: string;
}
