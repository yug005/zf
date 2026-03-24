import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsUUID } from 'class-validator';

export class UpdateMonitorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsString()
  featureName?: string;

  @IsOptional()
  @IsString()
  customerJourney?: string;

  @IsOptional()
  @IsString()
  teamOwner?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  businessCriticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsEnum(['STANDARD', 'PREMIUM', 'ENTERPRISE'])
  slaTier?: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE';

  @IsOptional()
  @IsEnum(['HTTP', 'TCP', 'PING', 'DNS', 'SSL'])
  type?: 'HTTP' | 'TCP' | 'PING' | 'DNS' | 'SSL';

  @IsOptional()
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(86400)
  intervalSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  expectedStatus?: number;

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  body?: any;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  retries?: number;
}
