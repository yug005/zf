import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { TargetService } from './target.service.js';
import { CreateTargetDto, UpdateTargetDto, LinkTargetDto, CreateCollectorDto } from './dto/target.dto.js';

@Controller('security/targets')
export class TargetController {
  constructor(private readonly targetService: TargetService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateTargetDto) {
    return this.targetService.create(req.user.id, dto, Boolean(req.user.isAdmin));
  }

  @Get()
  findAll(@Req() req: any) {
    return this.targetService.findAllByUser(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.targetService.findOneByUser(id, req.user.id);
  }

  @Get(':id/assets')
  listAssets(@Req() req: any, @Param('id') id: string) {
    return this.targetService.listAssets(id, req.user.id);
  }

  @Get(':id/collectors')
  listCollectors(@Req() req: any, @Param('id') id: string) {
    return this.targetService.listCollectors(id, req.user.id);
  }

  @Post(':id/collectors')
  createCollector(@Req() req: any, @Param('id') id: string, @Body() dto: CreateCollectorDto) {
    return this.targetService.createCollector(id, req.user.id, dto);
  }

  @Get(':id/scenario-packs')
  listScenarioPacks(@Req() req: any, @Param('id') id: string) {
    return this.targetService.listScenarioPacks(id, req.user.id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTargetDto) {
    return this.targetService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.targetService.remove(id, req.user.id);
  }

  @Post(':id/link')
  link(@Req() req: any, @Param('id') id: string, @Body() dto: LinkTargetDto) {
    return this.targetService.linkToProjectOrMonitor(id, req.user.id, dto);
  }

  @Delete(':id/link')
  unlink(@Req() req: any, @Param('id') id: string) {
    return this.targetService.unlinkFromProjectAndMonitor(id, req.user.id);
  }
}
