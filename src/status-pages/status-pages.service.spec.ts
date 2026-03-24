import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagesService } from './status-pages.service';

describe('StatusPagesService', () => {
  let service: StatusPagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StatusPagesService],
    }).compile();

    service = module.get<StatusPagesService>(StatusPagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
