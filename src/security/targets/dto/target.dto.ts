import { IsString, IsUrl, IsOptional, MaxLength, IsEnum, IsObject } from 'class-validator';

export class CreateTargetDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  baseUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  monitorId?: string;

  @IsOptional()
  @IsEnum(['WEB_APP', 'API', 'DOMAIN', 'CLOUD_ACCOUNT', 'IDENTITY_TENANT', 'HOST', 'COLLECTOR'])
  targetKind?: 'WEB_APP' | 'API' | 'DOMAIN' | 'CLOUD_ACCOUNT' | 'IDENTITY_TENANT' | 'HOST' | 'COLLECTOR';

  @IsOptional()
  @IsEnum(['LAB', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'])
  environment?: 'LAB' | 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTargetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  monitorId?: string;

  @IsOptional()
  @IsEnum(['WEB_APP', 'API', 'DOMAIN', 'CLOUD_ACCOUNT', 'IDENTITY_TENANT', 'HOST', 'COLLECTOR'])
  targetKind?: 'WEB_APP' | 'API' | 'DOMAIN' | 'CLOUD_ACCOUNT' | 'IDENTITY_TENANT' | 'HOST' | 'COLLECTOR';

  @IsOptional()
  @IsEnum(['LAB', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'])
  environment?: 'LAB' | 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  criticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class LinkTargetDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  monitorId?: string;
}

export class CreateCollectorDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEnum(['LAB', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'])
  environment?: 'LAB' | 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  allowlist?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  policy?: Record<string, unknown>;
}
