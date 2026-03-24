import { Controller, Get, Post, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Post /api-keys — generates an unhashed key and persists metadata
   */
  @Post()
  async createApiKey(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(userId, dto);
  }

  /**
   * List all current user Api Keys / metadata for rendering in tables
   */
  @Get()
  async listApiKeys(@CurrentUser('id') userId: string) {
    return this.apiKeyService.listApiKeys(userId);
  }

  /**
   * Forcefully revoke an API key for a user by id
   */
  @Delete(':id')
  async revokeApiKey(
    @CurrentUser('id') userId: string,
    @Param('id') keyId: string,
  ) {
    return this.apiKeyService.revokeApiKey(userId, keyId);
  }
}
