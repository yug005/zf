import { IsString, MinLength, IsOptional, Matches } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // userId is no longer accepted from the client — it comes from the JWT
}
