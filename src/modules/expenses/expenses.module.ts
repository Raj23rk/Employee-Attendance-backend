import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { DailyExpense, DailyExpenseSchema } from './schemas/daily-expense.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: DailyExpense.name, schema: DailyExpenseSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService, MongooseModule],
})
export class ExpensesModule {}

