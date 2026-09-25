import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Setup Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Employee Attendance & Portal API')
    .setDescription(
      'Complete Production API Specification for Employee Attendance, RBAC (CEO, HR, Manager, Employee), Leaves, Payroll, Tasks, Helpdesk, and Confidential Open Feedback.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');

  logger.log(`=======================================================`);
  logger.log(`🚀 Employee Attendance Backend running on port ${port}`);
  logger.log(`📚 Swagger API Docs: http://localhost:${port}/api/docs`);
  logger.log(`🔐 Seed Login Credentials (Password: Password@123):`);
  logger.log(`   - CEO:      ceo@wegrow.edu.in`);
  logger.log(`   - HR:       hr@wegrow.edu.in`);
  logger.log(`   - Manager:  manager@wegrow.edu.in`);
  logger.log(`   - Female:   priya.sharma@wegrow.edu.in (Maternity eligible)`);
  logger.log(`   - Male:     vijay.kumaran@wegrow.edu.in (3-day Paternity)`);
  logger.log(`=======================================================`);
}
bootstrap();
