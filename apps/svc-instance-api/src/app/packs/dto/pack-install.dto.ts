import { IsObject, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for POST /api/packs/install. Strict whitelist mode rejects any unknown
 * field at the controller boundary.
 */
export class PackInstallDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  packCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  releaseId!: string;

  @IsObject()
  manifest!: Record<string, unknown>;

  @IsUrl({ require_protocol: true, protocols: ['https'], require_tld: true })
  @MaxLength(2048)
  artifactUrl!: string;
}

/**
 * DTO for POST /api/packs/rollback.
 */
export class PackRollbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  packCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  releaseId!: string;
}
