import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalaryStructure, SalaryStructureSchema } from './schemas/salary-structure.schema';
import { Payslip, PayslipSchema } from './schemas/payslip.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SalaryStructure.name, schema: SalaryStructureSchema },
      { name: Payslip.name, schema: PayslipSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService, MongooseModule],
})
export class PayrollModule {}
