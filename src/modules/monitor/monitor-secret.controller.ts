import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { MonitorSecretService } from './monitor-secret.service.js';
import { CreateMonitorSecretDto } from './dto/create-monitor-secret.dto.js';

@Controller('monitor-secrets')
export class MonitorSecretController {
  constructor(private readonly monitorSecretService: MonitorSecretService) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.monitorSecretService.listSecrets(userId);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMonitorSecretDto,
  ) {
    return this.monitorSecretService.createSecret(userId, dto.name, dto.value, dto.kind);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.monitorSecretService.deleteSecret(userId, id);
  }
}
