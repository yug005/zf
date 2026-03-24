import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagesController } from './status-pages.controller';

describe('StatusPagesController', () => {
  let controller: StatusPagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusPagesController],
    }).compile();

    controller = module.get<StatusPagesController>(StatusPagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
