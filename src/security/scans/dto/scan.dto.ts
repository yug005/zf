import { IsEnum, IsOptional, IsString, IsArray, IsObject } from 'class-validator';

export class InitiateScanDto {
  @IsEnum(['STANDARD', 'ADVANCED', 'EMULATION', 'CONTINUOUS_VALIDATION'])
  tier: 'STANDARD' | 'ADVANCED' | 'EMULATION' | 'CONTINUOUS_VALIDATION';

  @IsOptional()
  @IsEnum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'])
  cadence?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledCategories?: string[];

  @IsOptional()
  @IsEnum(['STANDARD', 'ADVANCED', 'EMULATION', 'CONTINUOUS_VALIDATION'])
  executionMode?: 'STANDARD' | 'ADVANCED' | 'EMULATION' | 'CONTINUOUS_VALIDATION';

  @IsOptional()
  @IsObject()
  assetScope?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  authenticatedContext?: Record<string, unknown>;
}
