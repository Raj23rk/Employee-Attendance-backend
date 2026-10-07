import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SalaryStructure,
  SalaryStructureDocument,
} from './schemas/salary-structure.schema';
import {
  SalaryIncrement,
  SalaryIncrementDocument,
} from './schemas/salary-increment.schema';
import { Payslip, PayslipDocument } from './schemas/payslip.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Leave, LeaveDocument } from '../leaves/schemas/leave.schema';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { LeaveStatus } from '../../common/enums/leave-type.enum';
import {
  UpdateSalaryStructureDto,
  CreateSalaryIncrementDto,
  UpdateSalaryIncrementDto,
  GenerateMonthlyPayrollDto,
  GeneratePayslipDto,
} from './dto/payroll.dto';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function convertNumberToWords(num: number): string {
  if (num === 0) return 'Rupees Zero Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  const intPart = Math.floor(num);
  const words = inWords(intPart).trim();
  return `Rupees ${words} Only`;
}

function formatCurrency(amount: number): string {
  return (amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(SalaryStructure.name)
    private salaryModel: Model<SalaryStructureDocument>,
    @InjectModel(SalaryIncrement.name)
    private incrementModel: Model<SalaryIncrementDocument>,
    @InjectModel(Payslip.name)
    private payslipModel: Model<PayslipDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name)
    private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Leave.name)
    private leaveModel: Model<LeaveDocument>,
  ) {}

  // Helper: calculate salary components
  private calculateComponents(baseSalary: number) {
    const basic = Math.round(baseSalary * 0.5);
    const hra = Math.round(baseSalary * 0.25);
    const specialAllowance = Math.round(baseSalary * 0.15);
    const otherAllowances = Math.max(0, baseSalary - (basic + hra + specialAllowance));
    
    const pfDeduction = baseSalary >= 15000 ? Math.min(1800, Math.round(basic * 0.12)) : 0;
    const esiDeduction = baseSalary <= 21000 && baseSalary >= 10000 ? Math.round(baseSalary * 0.0075) : 0;
    const tdsDeduction = baseSalary >= 50000 ? Math.round(baseSalary * 0.05) : 0;
    
    const grossSalary = baseSalary;
    const netSalary = Math.max(0, grossSalary - (pfDeduction + esiDeduction + tdsDeduction));

    return {
      baseSalary,
      grossSalary,
      netSalary,
      basic,
      hra,
      specialAllowance,
      conveyanceAllowance: 0,
      otherAllowances,
      pfDeduction,
      esiDeduction,
      tdsDeduction,
      professionalTax: 0,
    };
  }

  // ==================== SALARY STRUCTURE ====================

  async getSalaryStructure(userId: string) {
    let structure = await this.salaryModel.findOne({
      userId: new Types.ObjectId(userId),
    });

    if (!structure) {
      const user = await this.userModel.findById(userId);
      const defaultBase = 20000;
      const comps = this.calculateComponents(defaultBase);
      structure = await this.salaryModel.create({
        userId: new Types.ObjectId(userId),
        ...comps,
      });
    }

    return { success: true, data: structure };
  }

  async getAllSalaryStructures(branch?: string) {
    const filter: any = {};
    const users = await this.userModel.find(branch ? { branch, isActive: true } : { isActive: true }).select('_id');
    const userIds = users.map(u => u._id);

    const list = await this.salaryModel
      .find({ userId: { $in: userIds } })
      .populate('userId', 'name employeeId email department role designation branch phone dateOfJoining')
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async getSalaryStructuresBranchWise(monthYear?: string) {
    const now = new Date();
    const currentMonthYear = monthYear || `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`; // e.g. "October 2026"

    const list = await this.salaryModel
      .find()
      .populate('userId', 'name employeeId email department role designation branch phone dateOfJoining isActive')
      .exec();

    // Fetch this month's generated payslips to attach attendance deduction data
    const payslips = await this.payslipModel.find({ monthYear: currentMonthYear }).exec();
    const payslipMap = new Map<string, any>(payslips.map(p => [p.userId.toString(), p]));

    const branchMap = new Map<string, any>();
    let totalCompanyEmployees = 0;
    let totalCompanyBaseSalary = 0;
    let totalCompanyAttendanceDeduction = 0;
    let totalCompanyFinalSalary = 0;

    for (const item of list) {
      const u = item.userId as any;
      if (!u || u.isActive === false) continue;

      const branchName = u.branch || 'Unassigned Branch';
      if (!branchMap.has(branchName)) {
        let shortName = branchName;
        if (branchName.includes('3.0')) shortName = 'Sivakasi 3.0';
        else if (branchName.includes('1.0')) shortName = 'Sivakasi 1.0';
        else if (branchName.includes('Srivilliputhur') || branchName.includes('2.0')) shortName = 'Srivilliputhur 2.0';

        branchMap.set(branchName, {
          branchName,
          shortName,
          monthYear: currentMonthYear,
          employeeCount: 0,
          totalBaseSalary: 0,
          totalAttendanceDeduction: 0,
          totalFinalSalary: 0,
          staff: [],
        });
      }

      const b = branchMap.get(branchName);
      const userPayslip = payslipMap.get(u._id.toString());

      const baseSalary = item.baseSalary || item.grossSalary || 0;
      const attendanceDeduction = userPayslip ? (userPayslip.attendanceDeduction || 0) : 0;
      const lopDays = userPayslip ? (userPayslip.lopDays || 0) : 0;
      const paidDays = userPayslip ? (userPayslip.paidDays || 30) : 30;
      const finalSalary = userPayslip ? (userPayslip.netPay || baseSalary) : Math.max(0, baseSalary - attendanceDeduction);

      b.employeeCount++;
      b.totalBaseSalary += baseSalary;
      b.totalAttendanceDeduction += attendanceDeduction;
      b.totalFinalSalary += finalSalary;

      b.staff.push({
        _id: item._id,
        userId: u._id,
        employeeId: u.employeeId,
        name: u.name,
        role: u.role,
        designation: u.designation || u.role,
        branch: u.branch,
        phone: u.phone,
        dateOfJoining: u.dateOfJoining,
        baseSalary,
        attendanceDeduction,
        lopDays,
        paidDays,
        finalSalary,
        status: userPayslip ? userPayslip.status : 'PROCESSED',
        paymentMode: item.paymentMode || 'BANK_TRANSFER',
      });

      totalCompanyEmployees++;
      totalCompanyBaseSalary += baseSalary;
      totalCompanyAttendanceDeduction += attendanceDeduction;
      totalCompanyFinalSalary += finalSalary;
    }

    const branches = Array.from(branchMap.values());

    return {
      success: true,
      monthYear: currentMonthYear,
      totalEmployees: totalCompanyEmployees,
      totalCompanyBaseSalary: Math.round(totalCompanyBaseSalary * 100) / 100,
      totalCompanyAttendanceDeduction: Math.round(totalCompanyAttendanceDeduction * 100) / 100,
      totalCompanyFinalSalary: Math.round(totalCompanyFinalSalary * 100) / 100,
      branchCount: branches.length,
      branches,
    };
  }

  async updateSalaryStructure(userId: string, dto: UpdateSalaryStructureDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const baseSalary = dto.baseSalary || dto.grossSalary || 20000;
    const autoComps = this.calculateComponents(baseSalary);

    const payload = {
      baseSalary,
      grossSalary: dto.grossSalary ?? autoComps.grossSalary,
      netSalary: dto.netSalary ?? autoComps.netSalary,
      basic: dto.basic ?? autoComps.basic,
      hra: dto.hra ?? autoComps.hra,
      specialAllowance: dto.specialAllowance ?? autoComps.specialAllowance,
      conveyanceAllowance: dto.conveyanceAllowance ?? autoComps.conveyanceAllowance,
      otherAllowances: dto.otherAllowances ?? autoComps.otherAllowances,
      pfDeduction: dto.pfDeduction ?? autoComps.pfDeduction,
      esiDeduction: dto.esiDeduction ?? autoComps.esiDeduction,
      tdsDeduction: dto.tdsDeduction ?? autoComps.tdsDeduction,
      professionalTax: dto.professionalTax ?? 0,
      paymentMode: dto.paymentMode || 'BANK_TRANSFER',
      notes: dto.notes || '',
    };

    const updated = await this.salaryModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: payload },
      { new: true, upsert: true },
    );

    return { success: true, message: 'Salary structure successfully updated', data: updated };
  }

  // ==================== SALARY INCREMENT CRUD ====================

  async createSalaryIncrement(dto: CreateSalaryIncrementDto, approvedById?: string) {
    const user = await this.userModel.findById(dto.userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    let currentStructure = await this.salaryModel.findOne({ userId: new Types.ObjectId(dto.userId) });
    const previousSalary = currentStructure ? (currentStructure.baseSalary || currentStructure.grossSalary) : 0;
    const newSalary = dto.newSalary;

    if (newSalary <= 0) {
      throw new BadRequestException('New salary must be greater than zero');
    }

    const incrementAmount = dto.incrementAmount ?? (newSalary - previousSalary);
    const incrementPercentage = previousSalary > 0 
      ? Math.round(((newSalary - previousSalary) / previousSalary) * 10000) / 100 
      : 0;

    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();

    const increment = await this.incrementModel.create({
      userId: new Types.ObjectId(dto.userId),
      previousSalary,
      incrementAmount,
      incrementPercentage,
      newSalary,
      effectiveDate,
      reason: dto.reason || 'Annual Appraisal',
      approvedBy: approvedById ? new Types.ObjectId(approvedById) : null,
      status: dto.status || 'APPROVED',
      remarks: dto.remarks || '',
    });

    if (increment.status === 'APPROVED') {
      const comps = this.calculateComponents(newSalary);
      await this.salaryModel.findOneAndUpdate(
        { userId: new Types.ObjectId(dto.userId) },
        { 
          $set: {
            ...comps,
            effectiveFrom: effectiveDate,
            notes: `Increment applied on ${effectiveDate.toISOString().split('T')[0]}: ${dto.reason || 'Appraisal'} (+₹${incrementAmount})`,
          }
        },
        { new: true, upsert: true },
      );
    }

    const populated = await this.incrementModel
      .findById(increment._id)
      .populate('userId', 'name employeeId email department role branch designation')
      .populate('approvedBy', 'name email role');

    return {
      success: true,
      message: `Salary increment of ₹${incrementAmount} successfully created for ${user.name}`,
      data: populated,
    };
  }

  async getAllSalaryIncrements(userId?: string) {
    const filter: any = {};
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const list = await this.incrementModel
      .find(filter)
      .populate('userId', 'name employeeId email department role branch designation')
      .populate('approvedBy', 'name email role')
      .sort({ effectiveDate: -1, createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async getSalaryIncrementById(id: string) {
    const record = await this.incrementModel
      .findById(id)
      .populate('userId', 'name employeeId email department role branch designation')
      .populate('approvedBy', 'name email role')
      .exec();

    if (!record) {
      throw new NotFoundException(`Salary increment record ${id} not found`);
    }

    return { success: true, data: record };
  }

  async updateSalaryIncrement(id: string, dto: UpdateSalaryIncrementDto, updaterId?: string) {
    const existing = await this.incrementModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Salary increment record ${id} not found`);
    }

    const updateFields: any = { ...dto };
    if (dto.effectiveDate) {
      updateFields.effectiveDate = new Date(dto.effectiveDate);
    }
    if (dto.newSalary && dto.newSalary !== existing.newSalary) {
      updateFields.incrementAmount = dto.newSalary - existing.previousSalary;
      updateFields.incrementPercentage = existing.previousSalary > 0
        ? Math.round(((dto.newSalary - existing.previousSalary) / existing.previousSalary) * 10000) / 100
        : 0;

      const comps = this.calculateComponents(dto.newSalary);
      await this.salaryModel.findOneAndUpdate(
        { userId: existing.userId },
        { $set: comps },
      );
    }

    const updated = await this.incrementModel
      .findByIdAndUpdate(id, { $set: updateFields }, { new: true })
      .populate('userId', 'name employeeId email department role branch designation')
      .populate('approvedBy', 'name email role');

    return { success: true, message: 'Salary increment record updated', data: updated };
  }

  async deleteSalaryIncrement(id: string) {
    const existing = await this.incrementModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Salary increment record ${id} not found`);
    }

    await this.incrementModel.findByIdAndDelete(id);
    return { success: true, message: 'Salary increment record deleted' };
  }

  // ==================== ATTENDANCE-BASED AUTOMATIC SALARY DEDUCTION & PAYSLIP ====================

  async generateMonthlyPayrollForAll(dto: GenerateMonthlyPayrollDto) {
    const now = new Date();
    let month = dto.month;
    let year = dto.year;

    if (!month || !year) {
      if (dto.monthYear) {
        if (/^\d{4}-\d{2}$/.test(dto.monthYear)) {
          const [y, m] = dto.monthYear.split('-');
          year = parseInt(y, 10);
          month = parseInt(m, 10);
        } else {
          const parts = dto.monthYear.split(' ');
          if (parts.length === 2) {
            const mIndex = MONTH_NAMES.findIndex(name => name.toLowerCase() === parts[0].toLowerCase());
            if (mIndex !== -1) month = mIndex + 1;
            year = parseInt(parts[1], 10);
          }
        }
      }
    }

    if (!month || !year) {
      month = now.getMonth() + 1;
      year = now.getFullYear();
    }

    const monthName = MONTH_NAMES[month - 1];
    const monthYearStr = `${monthName} ${year}`;

    const userQuery: any = { isActive: true };
    if (dto.branch) {
      userQuery.branch = dto.branch;
    }

    const activeUsers = await this.userModel.find(userQuery).exec();
    const results: any[] = [];
    let totalGrossAll = 0;
    let totalDeductionsAll = 0;
    let totalNetAll = 0;

    let index = 1;
    for (const user of activeUsers) {
      try {
        const payslipNo = `PR${String(index).padStart(3, '0')}/26-27`;
        const payslip = await this.calculateAndGeneratePayslipForUser(user, month, year, monthYearStr, payslipNo);
        results.push(payslip);
        totalGrossAll += payslip.grossPay;
        totalDeductionsAll += payslip.totalDeductions;
        totalNetAll += payslip.netPay;
        index++;
      } catch (err: any) {
        console.error(`Error generating payslip for user ${user.email}:`, err.message);
      }
    }

    return {
      success: true,
      monthYear: monthYearStr,
      month,
      year,
      processedCount: results.length,
      totalGross: Math.round(totalGrossAll * 100) / 100,
      totalDeductions: Math.round(totalDeductionsAll * 100) / 100,
      totalNet: Math.round(totalNetAll * 100) / 100,
      data: results,
    };
  }

  async calculateAndGeneratePayslipForUser(
    user: UserDocument,
    month: number,
    year: number,
    monthYearStr: string,
    defaultPayslipNo?: string,
  ) {
    const userId = user._id;
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

    let salaryStructure = await this.salaryModel.findOne({ userId });
    if (!salaryStructure) {
      const defaultComps = this.calculateComponents(20000);
      salaryStructure = await this.salaryModel.create({
        userId,
        ...defaultComps,
      });
    }

    const baseSalary = salaryStructure.baseSalary || salaryStructure.grossSalary || 20000;
    const dailyRate = Math.round((baseSalary / totalDaysInMonth) * 100) / 100;

    // Check DOJ pro-rata
    let unjoinedDays = 0;
    if (user.dateOfJoining) {
      const doj = new Date(user.dateOfJoining);
      if (doj.getFullYear() === year && (doj.getMonth() + 1) === month) {
        unjoinedDays = Math.max(0, doj.getDate() - 1);
      } else if (doj.getFullYear() > year || (doj.getFullYear() === year && doj.getMonth() + 1 > month)) {
        unjoinedDays = totalDaysInMonth;
      }
    }

    // Attendance records
    const attendances = await this.attendanceModel.find({
      userId,
      date: { $gte: startDateStr, $lte: endDateStr },
    }).exec();

    let presentDays = 0;
    let halfDays = 0;
    let absentRecordsCount = 0;
    let lateCount = 0;
    let latePenaltyDays = 0;

    for (const att of attendances) {
      if (att.status === AttendanceStatus.PRESENT || att.status === AttendanceStatus.WFH) {
        presentDays++;
      } else if (att.status === AttendanceStatus.HALF_DAY) {
        halfDays++;
      } else if (att.status === AttendanceStatus.ABSENT) {
        absentRecordsCount++;
      }

      if (att.isLate) lateCount++;
      if (att.isLatePenaltyApplied) latePenaltyDays += 0.5;
    }

    if (lateCount >= 4 && latePenaltyDays === 0) {
      latePenaltyDays = (lateCount - 3) * 0.5;
    }

    // Approved leaves
    const leaves = await this.leaveModel.find({
      userId,
      status: LeaveStatus.APPROVED,
      fromDate: { $lte: endDateStr },
      toDate: { $gte: startDateStr },
    }).exec();

    let paidLeaves = 0;
    let lopLeaves = 0;
    for (const lv of leaves) {
      if (lv.isLop) lopLeaves += lv.days || 0;
      else paidLeaves += lv.days || 0;
    }

    const lopDays = Math.min(
      totalDaysInMonth,
      Math.round((unjoinedDays + absentRecordsCount + (halfDays * 0.5) + latePenaltyDays + lopLeaves) * 10) / 10,
    );
    const paidDays = Math.max(0, Math.round((totalDaysInMonth - lopDays) * 10) / 10);
    const attendanceDeduction = Math.round(dailyRate * lopDays * 100) / 100;

    const pfDeduction = salaryStructure.pfDeduction || 0;
    const esiDeduction = salaryStructure.esiDeduction || 0;
    const tdsDeduction = salaryStructure.tdsDeduction || 0;
    const otherDeductions = salaryStructure.professionalTax || (pfDeduction + esiDeduction + tdsDeduction);

    const totalDeductions = Math.round((attendanceDeduction + otherDeductions) * 100) / 100;
    const grossPay = baseSalary;
    const netPay = Math.max(0, Math.round((grossPay - totalDeductions) * 100) / 100);
    const amountInWords = convertNumberToWords(netPay);

    const payslipNo = defaultPayslipNo || `PR${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}/26-27`;
    const paymentDate = new Date(year, month - 1, totalDaysInMonth);

    const payslip = await this.payslipModel.findOneAndUpdate(
      { userId, monthYear: monthYearStr },
      {
        $set: {
          userId,
          payslipNo,
          monthYear: monthYearStr,
          month,
          year,
          baseSalary,
          grossPay,
          incentives: 0,
          incentiveCount: 0,
          totalDaysInMonth,
          workingDays: 26,
          presentDays,
          halfDays,
          paidDays,
          absentDays: absentRecordsCount,
          paidLeaves,
          lateCount,
          latePenaltyDays,
          lopDays,
          dailyRate,
          attendanceDeduction,
          otherDeductions,
          pfDeduction,
          esiDeduction,
          tdsDeduction,
          totalDeductions,
          netPay,
          amountInWords,
          status: 'PROCESSED',
          paymentDate,
          breakdown: {
            basic: salaryStructure.basic || Math.round(baseSalary * 0.5),
            hra: salaryStructure.hra || Math.round(baseSalary * 0.25),
            specialAllowance: salaryStructure.specialAllowance || Math.round(baseSalary * 0.15),
            otherAllowances: salaryStructure.otherAllowances || 0,
            lopDeduction: attendanceDeduction,
            pf: pfDeduction,
            esi: esiDeduction,
            tds: tdsDeduction,
          },
          notes: unjoinedDays > 0 ? `Joined on ${user.dateOfJoining?.toISOString().split('T')[0]}. Pro-rated for ${paidDays} days.` : '',
        },
      },
      { new: true, upsert: true },
    ).populate('userId', 'name employeeId email department role designation branch phone dateOfJoining');

    return payslip;
  }

  // ==================== PAYSLIP RETRIEVAL & DOWNLOAD ====================

  async getPayslips(userId: string) {
    const payslips = await this.payslipModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'name employeeId email department role designation branch')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .exec();

    return { success: true, count: payslips.length, data: payslips };
  }

  async getAllPayslips(monthYear?: string, branch?: string) {
    const filter: any = {};
    if (monthYear) {
      filter.monthYear = monthYear;
    }

    if (branch) {
      const users = await this.userModel.find({ branch }).select('_id');
      filter.userId = { $in: users.map(u => u._id) };
    }

    const list = await this.payslipModel
      .find(filter)
      .populate('userId', 'name employeeId email department role designation branch phone dateOfJoining')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async getPayslipsBranchWise(monthYear?: string) {
    const filter: any = {};
    if (monthYear) filter.monthYear = monthYear;

    const list = await this.payslipModel
      .find(filter)
      .populate('userId', 'name employeeId email department role designation branch phone dateOfJoining')
      .sort({ createdAt: -1 })
      .exec();

    const branchMap = new Map<string, any>();
    let totalCompanyEmployees = 0;
    let totalCompanyGrossPay = 0;
    let totalCompanyDeductions = 0;
    let totalCompanyNetPay = 0;

    for (const p of list) {
      const u = p.userId as any;
      if (!u) continue;

      const branchName = u.branch || 'Unassigned Branch';
      if (!branchMap.has(branchName)) {
        let shortName = branchName;
        if (branchName.includes('3.0')) shortName = 'Sivakasi 3.0';
        else if (branchName.includes('1.0')) shortName = 'Sivakasi 1.0';
        else if (branchName.includes('Srivilliputhur') || branchName.includes('2.0')) shortName = 'Srivilliputhur 2.0';

        branchMap.set(branchName, {
          branchName,
          shortName,
          monthYear: p.monthYear,
          employeeCount: 0,
          totalBaseSalary: 0,
          totalGrossPay: 0,
          totalLopDeduction: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          payslips: [],
        });
      }

      const b = branchMap.get(branchName);
      b.employeeCount++;
      b.totalBaseSalary += p.baseSalary || 0;
      b.totalGrossPay += p.grossPay || 0;
      b.totalLopDeduction += p.attendanceDeduction || 0;
      b.totalDeductions += p.totalDeductions || 0;
      b.totalNetPay += p.netPay || 0;
      b.payslips.push(p);

      totalCompanyEmployees++;
      totalCompanyGrossPay += p.grossPay || 0;
      totalCompanyDeductions += p.totalDeductions || 0;
      totalCompanyNetPay += p.netPay || 0;
    }

    const branches = Array.from(branchMap.values());

    return {
      success: true,
      monthYear: monthYear || 'All Months',
      totalEmployees: totalCompanyEmployees,
      totalCompanyGrossPay: Math.round(totalCompanyGrossPay * 100) / 100,
      totalCompanyDeductions: Math.round(totalCompanyDeductions * 100) / 100,
      totalCompanyNetPay: Math.round(totalCompanyNetPay * 100) / 100,
      branchCount: branches.length,
      branches,
    };
  }

  async getPayslipById(id: string) {
    const payslip = await this.payslipModel
      .findById(id)
      .populate('userId', 'name employeeId email department role designation branch phone dateOfJoining bankDetails')
      .exec();

    if (!payslip) {
      throw new NotFoundException(`Payslip ${id} not found`);
    }

    return { success: true, data: payslip };
  }

  async generateManualPayslip(dto: GeneratePayslipDto) {
    const payslip = await this.payslipModel.findOneAndUpdate(
      { userId: new Types.ObjectId(dto.userId), monthYear: dto.monthYear },
      { $set: dto },
      { new: true, upsert: true },
    ).populate('userId', 'name employeeId email department role branch');

    return { success: true, message: 'Payslip generated', data: payslip };
  }

  /**
   * Official WeGrow Company Payslip Template Format
   * Matches company official PDF layout exactly.
   */
  async downloadPayslipHtml(userId: string, monthYear: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    let payslip = await this.payslipModel.findOne({
      userId: new Types.ObjectId(userId),
      monthYear,
    });

    if (!payslip) {
      const parts = monthYear.split(' ');
      let m = 10;
      let y = 2026;
      if (parts.length === 2) {
        const mIdx = MONTH_NAMES.findIndex(n => n.toLowerCase() === parts[0].toLowerCase());
        if (mIdx !== -1) m = mIdx + 1;
        y = parseInt(parts[1], 10) || 2026;
      }
      payslip = await this.calculateAndGeneratePayslipForUser(user as UserDocument, m, y, monthYear);
    }

    const empName = user?.name || 'Employee';
    const empId = user?.employeeId || 'WG-EMP-001';
    const designation = user?.designation || user?.role || 'Staff';
    const dailyPay = payslip.dailyRate || (payslip.baseSalary / (payslip.totalDaysInMonth || 30));
    const payslipNo = payslip.payslipNo || 'PR004/26-27';
    const payPeriod = payslip.monthYear || 'September 2026';
    const paymentDateStr = payslip.paymentDate 
      ? new Date(payslip.paymentDate).toLocaleDateString('en-GB').replace(/\//g, '-') 
      : `30-09-2026`;
    const paymentStatus = payslip.status || 'PROCESSED';

    const totalMonthDays = payslip.totalDaysInMonth || 30;
    const clDays = payslip.paidLeaves || 0;
    const lopDays = payslip.lopDays || 0;
    const payableDays = payslip.paidDays || totalMonthDays;

    const basicSalary = payslip.baseSalary || payslip.grossPay;
    const incentives = payslip.incentives || 0;
    const incentiveCount = payslip.incentiveCount || 0;
    const grossEarnings = basicSalary + incentives;

    const lopDeduction = payslip.attendanceDeduction || 0;
    const otherDeductions = payslip.otherDeductions || (payslip.totalDeductions - lopDeduction) || 0;
    const totalDeductions = lopDeduction + otherDeductions;
    const netPayable = Math.max(0, grossEarnings - totalDeductions);
    const amountInWords = payslip.amountInWords || convertNumberToWords(netPayable);

    const now = new Date();
    const generatedOnStr = `${now.toLocaleDateString('en-GB').replace(/\//g, '-')} ${now.toTimeString().split(' ')[0]}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payslip - ${payPeriod} - ${empName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #1e293b;
      padding: 30px 15px;
      font-size: 13px;
      line-height: 1.4;
    }
    .payslip-page {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #0f172a;
      padding: 28px 36px 36px 36px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
      position: relative;
    }
    
    /* Company Header */
    .company-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 12px;
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.5px;
    }
    .logo-text span {
      color: #0284c7;
    }
    .company-details {
      flex: 1;
    }
    .company-name {
      font-size: 22px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .company-address {
      font-size: 11.5px;
      color: #475569;
      margin-top: 2px;
    }
    .company-contact {
      font-size: 11.5px;
      color: #475569;
      margin-top: 2px;
    }
    
    .divider-line {
      height: 2.5px;
      background-color: #1e3a8a;
      margin: 10px 0 14px 0;
    }
    
    .payslip-title {
      text-align: center;
      font-size: 15px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }
    
    /* Tables & Section Boxes */
    .section-header-blue {
      background-color: #1e3a8a;
      color: #ffffff;
      font-weight: 700;
      font-size: 12.5px;
      padding: 6px 10px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      border: 1px solid #cbd5e1;
    }
    .grid-table td {
      padding: 5.5px 10px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
    }
    .grid-table td.label {
      width: 20%;
      color: #334155;
      font-weight: 600;
    }
    .grid-table td.value {
      width: 30%;
      color: #0f172a;
    }
    
    /* Attendance Summary Table */
    .att-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      text-align: center;
      border: 1px solid #cbd5e1;
    }
    .att-table th {
      background-color: #ffffff;
      color: #334155;
      font-size: 11.5px;
      font-weight: 700;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
    }
    .att-table td {
      background-color: #f8fafc;
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
      padding: 8px 8px;
      border: 1px solid #cbd5e1;
    }
    
    /* Earnings & Deductions Table */
    .finance-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0px;
      border: 1px solid #cbd5e1;
    }
    .finance-table th {
      background-color: #1e3a8a;
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 10px;
      border: 1px solid #1e3a8a;
      text-transform: uppercase;
    }
    .finance-table th.amount-col {
      text-align: right;
      width: 18%;
    }
    .finance-table td {
      padding: 6.5px 10px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
    }
    .finance-table td.amount {
      text-align: right;
      font-weight: 600;
      color: #0f172a;
    }
    .finance-table tr.total-row {
      background-color: #f8fafc;
      font-weight: 800;
    }
    .finance-table tr.total-row td {
      font-weight: 800;
      color: #0f172a;
    }
    
    /* Net Payable Bar */
    .net-payable-bar {
      background-color: #1e3a8a;
      color: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      margin-top: 0px;
      margin-bottom: 8px;
      border: 1px solid #1e3a8a;
    }
    .net-payable-label {
      font-size: 13.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .net-payable-val {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    
    /* Amount in Words */
    .amount-words-box {
      font-size: 12px;
      font-style: italic;
      color: #334155;
      margin-bottom: 45px;
      padding-left: 2px;
    }
    
    /* Note */
    .note-text {
      font-size: 10px;
      color: #64748b;
      line-height: 1.4;
      margin-bottom: 55px;
      text-align: justify;
    }
    
    /* Signatures */
    .signatures-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 0 40px;
    }
    .signature-block {
      text-align: center;
      width: 250px;
    }
    .signature-line {
      border-top: 1px solid #0f172a;
      margin-bottom: 6px;
    }
    .sign-title {
      font-weight: 700;
      font-size: 12px;
      color: #0f172a;
    }
    .sign-sub {
      font-size: 11px;
      color: #64748b;
    }
    
    /* Footer */
    .footer-line {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #64748b;
      font-style: italic;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }
    
    @media print {
      body { background: transparent; padding: 0; }
      .payslip-page { border: none; box-shadow: none; padding: 20px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="payslip-page">
    <!-- Company Header -->
    <div class="company-header">
      <div class="logo-container">
        <div class="logo-text">We<span>Gröw</span></div>
      </div>
      <div class="company-details">
        <div class="company-name">WEGROW SKILL CAMPUS</div>
        <div class="company-address">100A/4, First Floor, Ibaco Upstairs, Opposite to Bell Hotel, Thiruthangal Road, Sivakasi - 626123</div>
        <div class="company-contact">Email: wegrowskillcampus@gmail.com | Phone: 9344337331</div>
      </div>
    </div>

    <div class="divider-line"></div>

    <div class="payslip-title">
      PAYSLIP FOR THE MONTH OF ${payPeriod.toUpperCase()}
    </div>

    <!-- 1. Employee & Payroll Details -->
    <div class="section-header-blue">EMPLOYEE & PAYROLL DETAILS</div>
    <table class="grid-table">
      <tr>
        <td class="label">Employee Name</td>
        <td class="value">: <strong>${empName}</strong></td>
        <td class="label">Payslip No.</td>
        <td class="value">: <strong>${payslipNo}</strong></td>
      </tr>
      <tr>
        <td class="label">Employee ID</td>
        <td class="value">: ${empId}</td>
        <td class="label">Pay Period</td>
        <td class="value">: ${payPeriod}</td>
      </tr>
      <tr>
        <td class="label">Designation</td>
        <td class="value">: ${designation}</td>
        <td class="label">Payment Date</td>
        <td class="value">: ${paymentDateStr}</td>
      </tr>
      <tr>
        <td class="label">Daily Pay</td>
        <td class="value">: Rs. ${formatCurrency(dailyPay)}</td>
        <td class="label">Payment Status</td>
        <td class="value">: <strong>${paymentStatus}</strong></td>
      </tr>
    </table>

    <!-- 2. Attendance & Leave Summary -->
    <div class="section-header-blue" style="background-color: #f1f5f9; color: #1e3a8a; border: 1px solid #cbd5e1; border-bottom: none;">
      ATTENDANCE & LEAVE SUMMARY
    </div>
    <table class="att-table">
      <thead>
        <tr>
          <th>Total Month Days</th>
          <th>Casual Leave (CL)</th>
          <th>Loss of Pay (LOP)</th>
          <th>Payable Days</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${totalMonthDays}</td>
          <td>${clDays} Day(s)</td>
          <td>${lopDays} Day(s)</td>
          <td>${payableDays} Day(s)</td>
        </tr>
      </tbody>
    </table>

    <!-- 3. Earnings & Deductions Table -->
    <table class="finance-table">
      <thead>
        <tr>
          <th>EARNINGS</th>
          <th class="amount-col">AMOUNT</th>
          <th>DEDUCTIONS</th>
          <th class="amount-col">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic / Monthly Salary</td>
          <td class="amount">Rs. ${formatCurrency(basicSalary)}</td>
          <td>Loss of Pay (LOP) Deduction</td>
          <td class="amount">Rs. ${formatCurrency(lopDeduction)}</td>
        </tr>
        <tr>
          <td>Incentives (${incentiveCount} References)</td>
          <td class="amount">Rs. ${formatCurrency(incentives)}</td>
          <td>Other Deductions</td>
          <td class="amount">Rs. ${formatCurrency(otherDeductions)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>GROSS EARNINGS (A)</strong></td>
          <td class="amount"><strong>Rs. ${formatCurrency(grossEarnings)}</strong></td>
          <td><strong>TOTAL DEDUCTIONS (B)</strong></td>
          <td class="amount"><strong>Rs. ${formatCurrency(totalDeductions)}</strong></td>
        </tr>
      </tbody>
    </table>

    <!-- 4. Net Payable Amount Bar -->
    <div class="net-payable-bar">
      <span class="net-payable-label">NET PAYABLE AMOUNT (A - B)</span>
      <span class="net-payable-val">Rs. ${formatCurrency(netPayable)}</span>
    </div>

    <!-- 5. Amount in Words -->
    <div class="amount-words-box">
      <strong>Amount in Words:</strong> ${amountInWords}
    </div>

    <!-- 6. Note -->
    <div class="note-text">
      Note: This is a system-generated salary slip and does not require a physical signature. Any discrepancy should be reported to the HR Department within 7 days of issuance.
    </div>

    <!-- 7. Signatures -->
    <div class="signatures-row">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="sign-title">Employee Signature</div>
        <div class="sign-sub">(Ack. of receipt)</div>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="sign-title">Authorized Signatory</div>
        <div class="sign-sub">(WeGrow Skill Campus)</div>
      </div>
    </div>

    <!-- 8. Footer -->
    <div class="footer-line">
      <span>Confidential - Generated by HR System on ${generatedOnStr}</span>
      <span>Page 1 of 1</span>
    </div>
  </div>
</body>
</html>
`;
  }
}
