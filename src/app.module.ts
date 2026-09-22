import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';

// Common Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Application Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { EngageModule } from './modules/engage/engage.module';
import { HelpdeskModule } from './modules/helpdesk/helpdesk.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { LearningModule } from './modules/learning/learning.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AssetsModule } from './modules/assets/assets.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { SeedModule } from './modules/seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('database.url'),
      }),
    }),
    AuthModule,
    UsersModule,
    NotificationsModule,
    AttendanceModule,
    LeavesModule,
    DashboardModule,
    TasksModule,
    TimesheetsModule,
    PayrollModule,
    ExpensesModule,
    OrganizationModule,
    EngageModule,
    HelpdeskModule,
    PerformanceModule,
    LearningModule,
    DocumentsModule,
    AssetsModule,
    FeedbackModule,
    SeedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
