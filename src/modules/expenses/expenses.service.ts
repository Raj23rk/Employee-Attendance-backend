import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense, ExpenseDocument } from './schemas/expense.schema';
import { DailyExpense, DailyExpenseDocument } from './schemas/daily-expense.schema';
import { SubmitExpenseDto, ReviewExpenseDto } from './dto/expense.dto';
import { CreateDailyExpenseDto, UpdateDailyExpenseDto, DailyExpenseFilterDto } from './dto/daily-expense.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(DailyExpense.name) private dailyExpenseModel: Model<DailyExpenseDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async submitExpense(userId: string, dto: SubmitExpenseDto) {
    const expense = await this.expenseModel.create({
      ...dto,
      userId: new Types.ObjectId(userId),
      status: 'PENDING',
    });

    const user = await this.userModel.findById(userId);
    if (user?.managerId) {
      const manager = await this.userModel.findById(user.managerId);
      if (manager) {
        await this.notificationsService.createInAppNotification(
          manager._id.toString(),
          'Expense Claim Submitted',
          `${user.name} submitted an expense claim of ₹${dto.amount} (${dto.category}).`,
          'INFO',
          '/expenses/pending-approvals',
        );
      }
    }

    return { success: true, message: 'Expense claim submitted', data: expense };
  }

  async getMyExpenses(userId: string) {
    const list = await this.expenseModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async getPendingApprovals(reviewerId: string, role: Role) {
    let filter: any = { status: 'PENDING' };

    if (role === Role.MANAGER) {
      const reportees = await this.userModel.find({ managerId: new Types.ObjectId(reviewerId) }).select('_id');
      const reporteeIds = reportees.map((r) => r._id);
      filter.userId = { $in: reporteeIds };
    }

    const list = await this.expenseModel
      .find(filter)
      .populate('userId', 'name employeeId department')
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, count: list.length, data: list };
  }

  async reviewExpense(id: string, reviewerId: string, dto: ReviewExpenseDto) {
    const expense = await this.expenseModel.findById(id);
    if (!expense) {
      throw new NotFoundException('Expense claim not found');
    }

    expense.status = dto.status;
    expense.reviewedBy = new Types.ObjectId(reviewerId);
    expense.remarks = dto.remarks || '';
    expense.reviewedAt = new Date();
    await expense.save();

    const employee = await this.userModel.findById(expense.userId);
    if (employee) {
      await this.notificationsService.createInAppNotification(
        employee._id.toString(),
        `Expense Claim ${dto.status}`,
        `Your expense claim of ₹${expense.amount} was marked as ${dto.status.toLowerCase()}.`,
        dto.status === 'APPROVED' || dto.status === 'REIMBURSED' ? 'SUCCESS' : 'WARNING',
        '/expenses/my',
      );
    }

    return { success: true, message: `Expense claim ${dto.status.toLowerCase()}`, data: expense };
  }

  // ==========================================
  // ADMIN DAILY OFFICE EXPENSES & BILLS
  // ==========================================

  async createDailyExpense(userId: string, dto: CreateDailyExpenseDto) {
    const created = await this.dailyExpenseModel.create({
      ...dto,
      recordedBy: new Types.ObjectId(userId),
    });

    const populated = await this.dailyExpenseModel
      .findById(created._id)
      .populate('recordedBy', 'name email employeeId role')
      .exec();

    return {
      success: true,
      message: 'Daily expense recorded successfully',
      data: populated,
    };
  }

  async getDailyExpenses(query: DailyExpenseFilterDto) {
    const filter: any = {};

    if (query.date) {
      filter.date = query.date;
    } else if (query.startDate && query.endDate) {
      filter.date = { $gte: query.startDate, $lte: query.endDate };
    } else if (query.year && query.month) {
      const m = query.month.toString().padStart(2, '0');
      filter.date = { $regex: new RegExp(`^${query.year}-${m}`) };
    } else if (query.year) {
      filter.date = { $regex: new RegExp(`^${query.year}-`) };
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.paymentMode) {
      filter.paymentMode = query.paymentMode;
    }

    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;

    const [items, totalCount] = await Promise.all([
      this.dailyExpenseModel
        .find(filter)
        .populate('recordedBy', 'name email employeeId role')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.dailyExpenseModel.countDocuments(filter),
    ]);

    // Calculate sum for the matching filter
    const totalAmountAgg = await this.dailyExpenseModel.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalAmount = totalAmountAgg.length > 0 ? totalAmountAgg[0].total : 0;

    return {
      success: true,
      totalCount,
      totalAmount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      data: items,
    };
  }

  async getDailyExpenseById(id: string) {
    const expense = await this.dailyExpenseModel
      .findById(id)
      .populate('recordedBy', 'name email employeeId role')
      .exec();

    if (!expense) {
      throw new NotFoundException('Daily expense record not found');
    }

    return { success: true, data: expense };
  }

  async updateDailyExpense(id: string, dto: UpdateDailyExpenseDto) {
    const updated = await this.dailyExpenseModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .populate('recordedBy', 'name email employeeId role')
      .exec();

    if (!updated) {
      throw new NotFoundException('Daily expense record not found');
    }

    return {
      success: true,
      message: 'Daily expense record updated',
      data: updated,
    };
  }

  async deleteDailyExpense(id: string) {
    const deleted = await this.dailyExpenseModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Daily expense record not found');
    }

    return {
      success: true,
      message: 'Daily expense record deleted successfully',
    };
  }

  // ==========================================
  // CEO EXECUTIVE MONTHLY EXPENSE OVERVIEW
  // ==========================================

  async getCeoMonthlyOverview(year: number, month: number) {
    const monthPad = month.toString().padStart(2, '0');
    const monthPrefix = `${year}-${monthPad}`;
    const dateRegex = new RegExp(`^${monthPrefix}`);

    // Fetch all items for this month
    const expenses = await this.dailyExpenseModel
      .find({ date: { $regex: dateRegex } })
      .populate('recordedBy', 'name email employeeId role')
      .sort({ date: 1, createdAt: 1 })
      .exec();

    const totalAmount = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalTransactions = expenses.length;

    // Category breakdown
    const categoryMap = new Map<string, { totalAmount: number; count: number }>();
    // Daily breakdown
    const dailyMap = new Map<string, { totalAmount: number; count: number; items: any[] }>();

    for (const exp of expenses) {
      // Category map
      const cat = exp.category || 'Miscellaneous';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { totalAmount: 0, count: 0 });
      }
      const catEntry = categoryMap.get(cat)!;
      catEntry.totalAmount += exp.amount;
      catEntry.count += 1;

      // Daily map
      const day = exp.date;
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { totalAmount: 0, count: 0, items: [] });
      }
      const dayEntry = dailyMap.get(day)!;
      dayEntry.totalAmount += exp.amount;
      dayEntry.count += 1;
      dayEntry.items.push({
        id: exp._id,
        title: exp.title,
        category: exp.category,
        amount: exp.amount,
        paymentMode: exp.paymentMode,
        vendorName: exp.vendorName,
        billUrl: exp.billUrl,
        recordedBy: exp.recordedBy,
      });
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      totalAmount: stats.totalAmount,
      count: stats.count,
      percentage: totalAmount > 0 ? Number(((stats.totalAmount / totalAmount) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      totalAmount: stats.totalAmount,
      count: stats.count,
      items: stats.items,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Bills with document attachments
    const billsWithAttachments = expenses
      .filter((e) => !!e.billUrl)
      .map((e) => ({
        id: e._id,
        title: e.title,
        category: e.category,
        amount: e.amount,
        date: e.date,
        billUrl: e.billUrl,
        vendorName: e.vendorName,
        recordedBy: e.recordedBy,
      }));

    return {
      success: true,
      period: {
        year,
        month,
        monthYear: monthPrefix,
      },
      summary: {
        totalAmount,
        totalTransactions,
        attachmentsCount: billsWithAttachments.length,
        averageDailySpend: dailyBreakdown.length > 0 ? Math.round(totalAmount / dailyBreakdown.length) : 0,
      },
      categoryBreakdown,
      dailyBreakdown,
      billsWithAttachments,
      allExpenses: expenses,
    };
  }
}

