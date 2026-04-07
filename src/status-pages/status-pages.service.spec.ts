import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagesService } from './status-pages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StatusPagesService', () => {
  let service: StatusPagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusPagesService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<StatusPagesService>(StatusPagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
