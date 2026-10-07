import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalaryStructure, SalaryStructureSchema } from './schemas/salary-structure.schema';
import { SalaryIncrement, SalaryIncrementSchema } from './schemas/salary-increment.schema';
import { Payslip, PayslipSchema } from './schemas/payslip.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Leave, LeaveSchema } from '../leaves/schemas/leave.schema';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalaryStructure.name, schema: SalaryStructureSchema },
      { name: SalaryIncrement.name, schema: SalaryIncrementSchema },
      { name: Payslip.name, schema: PayslipSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Leave.name, schema: LeaveSchema },
    ]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService, MongooseModule],
})
export class PayrollModule {}
