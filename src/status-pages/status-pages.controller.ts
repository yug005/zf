import { Controller, Get, Post, Patch, Body, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { StatusPagesService } from './status-pages.service.js';
import { CreateStatusPageDto } from './dto/create-status-page.dto.js';
import { UpdateStatusPageDto } from './dto/update-status-page.dto.js';
import { CurrentUser } from '../modules/auth/decorators/current-user.decorator.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';

@Controller('status-pages')
export class StatusPagesController {
  constructor(private readonly statusPagesService: StatusPagesService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStatusPageDto,
  ) {
    return this.statusPagesService.create(userId, dto);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    return this.statusPagesService.findAllForUser(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.statusPagesService.findOneForUser(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusPageDto,
  ) {
    return this.statusPagesService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.statusPagesService.delete(userId, id);
  }

  @Post(':id/monitors')
  async addMonitor(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('monitorId') monitorId: string,
  ) {
    return this.statusPagesService.addMonitor(userId, id, monitorId);
  }

  @Delete(':id/monitors/:monitorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMonitor(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('monitorId') monitorId: string,
  ) {
    return this.statusPagesService.removeMonitor(userId, id, monitorId);
  }

  @Public()
  @Get('public/:slug')
  async getPublicPage(@Param('slug') slug: string) {
    return this.statusPagesService.getPublicPage(slug);
  }
}
