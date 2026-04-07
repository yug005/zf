import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TestAuthRequestTemplateDto {
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

class TestMultiStepAuthDto {
  @ValidateNested()
  @Type(() => TestAuthRequestTemplateDto)
  login!: TestAuthRequestTemplateDto;

  @IsString()
  tokenJsonPath!: string;

  @IsOptional()
  @IsString()
  targetHeader?: string;

  @IsOptional()
  @IsString()
  tokenPrefix?: string;
}

class TestAuthConfigDto {
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
  @Type(() => TestMultiStepAuthDto)
  multiStep?: TestMultiStepAuthDto;
}

class TestKeywordValidationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbidden?: string[];
}

class TestJsonPathRuleDto {
  @IsString()
  path!: string;

  @IsEnum(['EXISTS', 'EQUALS', 'CONTAINS'])
  operator!: 'EXISTS' | 'EQUALS' | 'CONTAINS';

  @IsOptional()
  expectedValue?: unknown;
}

class TestValidationConfigDto {
  @IsOptional()
  @IsInt()
  expectedStatus?: number;

  @IsOptional()
  @IsInt()
  latencyThresholdMs?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestKeywordValidationDto)
  keyword?: TestKeywordValidationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestJsonPathRuleDto)
  jsonPaths?: TestJsonPathRuleDto[];
}

export class TestMonitorConfigDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsEnum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

  @IsOptional()
  headers?: Record<string, string>;

  @IsOptional()
  body?: unknown;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeoutMs?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestAuthConfigDto)
  authConfig?: TestAuthConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestValidationConfigDto)
  validationConfig?: TestValidationConfigDto;
}
