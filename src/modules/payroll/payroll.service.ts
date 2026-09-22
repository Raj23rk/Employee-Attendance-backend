import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SalaryStructure,
  SalaryStructureDocument,
} from './schemas/salary-structure.schema';
import { Payslip, PayslipDocument } from './schemas/payslip.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(SalaryStructure.name)
    private salaryModel: Model<SalaryStructureDocument>,
    @InjectModel(Payslip.name)
    private payslipModel: Model<PayslipDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async getSalaryStructure(userId: string) {
    let structure = await this.salaryModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!structure) {
      structure = await this.salaryModel.create({
        userId: new Types.ObjectId(userId),
        grossSalary: 65000,
        netSalary: 58500,
        basic: 32500,
        hra: 16250,
        specialAllowance: 9750,
        otherAllowances: 6500,
        pfDeduction: 1800,
        esiDeduction: 750,
        tdsDeduction: 3950,
      });
    }

    return { success: true, data: structure };
  }

  async getPayslips(userId: string) {
    let payslips = await this.payslipModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ monthYear: -1 })
      .exec();

    if (payslips.length === 0) {
      // Create initial payslips for demonstration
      payslips = [
        await this.payslipModel.create({
          userId: new Types.ObjectId(userId),
          monthYear: 'August 2026',
          grossPay: 65000,
          netPay: 58500,
          totalDeductions: 6500,
          workingDays: 31,
          paidDays: 31,
          status: 'PAID',
        }),
        await this.payslipModel.create({
          userId: new Types.ObjectId(userId),
          monthYear: 'July 2026',
          grossPay: 65000,
          netPay: 58500,
          totalDeductions: 6500,
          workingDays: 31,
          paidDays: 31,
          status: 'PAID',
        }),
      ];
    }

    return { success: true, count: payslips.length, data: payslips };
  }

  async downloadPayslipHtml(userId: string, monthYear: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    const structure = await this.getSalaryStructure(userId);
    const s = structure.data;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip - ${monthYear} - ${user?.name}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .table th, .table td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
    .table th { background-color: #f8fafc; font-weight: 600; }
    .net-box { margin-top: 30px; padding: 16px; background-color: #eff6ff; border-radius: 8px; font-size: 18px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">WEGROW EDUCATION - PAYSLIP</div>
    <p>Pay Period: <strong>${monthYear}</strong> | Generated: <strong>${new Date().toLocaleDateString()}</strong></p>
  </div>
  <table class="table">
    <tr><td><strong>Employee Name</strong></td><td>${user?.name}</td><td><strong>Employee ID</strong></td><td>${user?.employeeId}</td></tr>
    <tr><td><strong>Department</strong></td><td>${user?.department}</td><td><strong>Role</strong></td><td>${user?.role}</td></tr>
  </table>
  <h3 style="margin-top: 30px;">Earnings & Deductions</h3>
  <table class="table">
    <thead>
      <tr><th>Earnings</th><th>Amount (INR)</th><th>Deductions</th><th>Amount (INR)</th></tr>
    </thead>
    <tbody>
      <tr><td>Basic Salary</td><td>₹${s.basic}</td><td>Provident Fund (PF)</td><td>₹${s.pfDeduction}</td></tr>
      <tr><td>HRA</td><td>₹${s.hra}</td><td>ESI</td><td>₹${s.esiDeduction}</td></tr>
      <tr><td>Special Allowance</td><td>₹${s.specialAllowance}</td><td>TDS (Tax)</td><td>₹${s.tdsDeduction}</td></tr>
      <tr><td>Other Allowances</td><td>₹${s.otherAllowances}</td><td></td><td></td></tr>
      <tr style="font-weight: bold; background: #f1f5f9;"><td>Gross Earnings</td><td>₹${s.grossSalary}</td><td>Total Deductions</td><td>₹${s.pfDeduction + s.esiDeduction + s.tdsDeduction}</td></tr>
    </tbody>
  </table>
  <div class="net-box">
    Net Take-Home Pay: ₹${s.netSalary}
  </div>
</body>
</html>
`;
  }

  // Admin Payroll Management
  async getAllSalaryStructures() {
    const list = await this.salaryModel
      .find()
      .populate('userId', 'name employeeId email department role designation')
      .exec();
    return { success: true, count: list.length, data: list };
  }

  async updateSalaryStructure(userId: string, dto: any) {
    const updated = await this.salaryModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: dto },
      { new: true, upsert: true },
    );
    return { success: true, message: 'Salary structure saved', data: updated };
  }

  async generatePayslip(dto: any) {
    const payslip = await this.payslipModel.findOneAndUpdate(
      { userId: new Types.ObjectId(dto.userId), monthYear: dto.monthYear },
      { $set: dto },
      { new: true, upsert: true },
    );
    return { success: true, message: 'Payslip generated', data: payslip };
  }

  async getAllPayslips(monthYear?: string) {
    const filter: any = {};
    if (monthYear) filter.monthYear = monthYear;
    const list = await this.payslipModel
      .find(filter)
      .populate('userId', 'name employeeId email department')
      .sort({ createdAt: -1 })
      .exec();
    return { success: true, count: list.length, data: list };
  }
}
