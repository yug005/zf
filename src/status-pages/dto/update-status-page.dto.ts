import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class UpdateStatusPageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  monitorIds?: string[];

  @IsOptional()
  @IsString()
  mode?: 'SIMPLE' | 'ADVANCED';
}
