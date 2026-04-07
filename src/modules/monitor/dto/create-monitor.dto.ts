import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

class AuthRequestTemplateDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  body?: unknown;
}

class MultiStepAuthConfigDto {
  @ValidateNested()
  @Type(() => AuthRequestTemplateDto)
  login!: AuthRequestTemplateDto;

  @IsString()
  tokenJsonPath!: string;

  @IsOptional()
  @IsString()
  targetHeader?: string;

  @IsOptional()
  @IsString()
  tokenPrefix?: string;
}

class AuthConfigDto {
  @IsEnum(['NONE', 'BEARER', 'API_KEY', 'BASIC', 'MULTI_STEP'])
  type!: 'NONE' | 'BEARER' | 'API_KEY' | 'BASIC' | 'MULTI_STEP';

  @IsOptional()
  @IsString()
  secretId?: string;

  @IsOptional()
  @IsString()
  secretValue?: string;

  @IsOptional()
  @IsString()
  usernameSecretId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  passwordSecretId?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  headerName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MultiStepAuthConfigDto)
  multiStep?: MultiStepAuthConfigDto;
}

class KeywordValidationConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbidden?: string[];

  @IsOptional()
  @IsBoolean()
  stripHtml?: boolean;

  @IsOptional()
  @IsBoolean()
  matchExact?: boolean;
}

class JsonPathRuleDto {
  @IsString()
  path!: string;

  @IsEnum(['EXISTS', 'EQUALS', 'CONTAINS'])
  operator!: 'EXISTS' | 'EQUALS' | 'CONTAINS';

  @IsOptional()
  expectedValue?: unknown;
}

class ValidationConfigDto {
  @IsOptional()
  @IsInt()
  expectedStatus?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  latencyThresholdMs?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => KeywordValidationConfigDto)
  keyword?: KeywordValidationConfigDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JsonPathRuleDto)
  jsonPaths?: JsonPathRuleDto[];
}

class AlertRecipientConfigDto {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slackWebhookUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  telegramChatIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatsappNumbers?: string[];
}

class AlertConfigDto {
  @IsOptional()
  @IsArray()
  @IsEnum(['EMAIL', 'SLACK', 'TELEGRAM', 'WEBHOOK', 'SMS', 'WHATSAPP'], { each: true })
  channels?: Array<'EMAIL' | 'SLACK' | 'TELEGRAM' | 'WEBHOOK' | 'SMS' | 'WHATSAPP'>;

  @IsOptional()
  @IsInt()
  @Min(1)
  failureThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  retryIntervalSeconds?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlertRecipientConfigDto)
  recipients?: AlertRecipientConfigDto;
}

export class CreateMonitorDto {
  @IsString()
  name!: string;

  @IsString()
  url!: string;

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
  @ValidateNested()
  @Type(() => AuthConfigDto)
  authConfig?: AuthConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ValidationConfigDto)
  validationConfig?: ValidationConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlertConfigDto)
  alertConfig?: AlertConfigDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  probeRegions?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  retries?: number;

  @IsUUID()
  projectId!: string;
}
