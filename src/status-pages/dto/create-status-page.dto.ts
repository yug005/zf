import { IsString, IsNotEmpty, Matches, IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateStatusPageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  slug: string;

  @IsArray()
  @IsOptional()
  @IsUUID('4', { each: true })
  monitorIds?: string[];
}
