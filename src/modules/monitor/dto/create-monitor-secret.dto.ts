import { IsEnum, IsString } from 'class-validator';
import { MonitorSecretKind } from '@prisma/client';

export class CreateMonitorSecretDto {
  @IsString()
  name!: string;

  @IsString()
  value!: string;

  @IsEnum(MonitorSecretKind)
  kind!: MonitorSecretKind;
}
