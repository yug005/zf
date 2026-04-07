import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  const backendUrl = configService.get<string>('BACKEND_URL', 'http://localhost:3000');
  validateEnvironment(configService, logger);

  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin === frontendUrl) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS blocked'));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`Zer0Friction API running on ${backendUrl}`);
  logger.log(`Frontend origin allowed: ${frontendUrl}`);
  logger.log(`Health check: ${backendUrl}/health`);
  logger.log(`Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
}

function validateEnvironment(configService: ConfigService, logger: Logger) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const requiredEverywhere = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MONITOR_SECRET_KEY'];
  const requiredInProduction = ['FRONTEND_URL', 'BACKEND_URL', 'RESEND_API_KEY'];

  const missing = [
    ...requiredEverywhere.filter((key) => !configService.get<string>(key)),
    ...(nodeEnv === 'production'
      ? requiredInProduction.filter((key) => !configService.get<string>(key))
      : []),
  ];

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const razorpayVars = [
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
  ] as const;
  const configuredCount = razorpayVars.filter((key) => configService.get<string>(key)).length;
  if (configuredCount > 0 && configuredCount < razorpayVars.length) {
    throw new Error(
      `Razorpay configuration is incomplete. Set all of: ${razorpayVars.join(', ')}`,
    );
  }

  logger.log(`Environment validation complete for ${nodeEnv}`);
}

bootstrap();
