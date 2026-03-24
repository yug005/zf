import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class IngestDeployDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  projectSlug?: string;

  @IsOptional()
  @IsUUID()
  monitorId?: string;

  @IsOptional()
  @IsEnum(['DEPLOY', 'RELEASE', 'CONFIG', 'INFRASTRUCTURE', 'MANUAL'])
  type?: 'DEPLOY' | 'RELEASE' | 'CONFIG' | 'INFRASTRUCTURE' | 'MANUAL';

  @IsOptional()
  @IsEnum(['API', 'GITHUB', 'VERCEL', 'RAILWAY'])
  provider?: 'API' | 'GITHUB' | 'VERCEL' | 'RAILWAY';

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  repository?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  deploymentId?: string;

  @IsOptional()
  @IsString()
  deploymentUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  watchWindowMinutes?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  happenedAt?: string;
}
