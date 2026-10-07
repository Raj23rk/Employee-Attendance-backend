require('dotenv').config();
const mongoose = require('mongoose');

const staffData = [
  // Sivakasi Branch
  {
    name: 'Ashokkumar M',
    email: 'ak45ashokkumar@gmail.com',
    phone: '9025977171',
    role: 'ADMIN',
    designation: 'Incharger',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 19000,
    dateOfJoining: '2026-05-20',
  },
  {
    name: 'DEVIPRIYA S',
    email: 'devisudalai2003@gmail.com',
    phone: '7708406689',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 19000,
    dateOfJoining: '2026-01-08',
  },
  {
    name: 'Dr.Lakshmipriya',
    email: 'lakshmipriya@psr.edu.in',
    phone: '6383039802',
    role: 'GM',
    designation: 'General Manager / Management',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 47904,
    dateOfJoining: '2026-01-01',
  },
  {
    name: 'GOPINATH C',
    email: 'srisaigopi31@gmail.com',
    phone: '9344722769',
    role: 'HR_MANAGER',
    designation: 'HR Manager',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 23000,
    dateOfJoining: '2026-09-07',
  },
  {
    name: 'Ajith kumar',
    email: 'ajithkumar.bba.anjac@gmail.com',
    phone: '7598951588',
    role: 'MANAGER',
    designation: 'Manager',
    branch: 'WeGrow Skill Campus – Sivakasi Branch 1.0',
    baseSalary: 25000,
    dateOfJoining: '2025-12-26',
  },
  {
    name: 'LAKSHMIPRIYA S',
    email: 'lakshmipriya.srbe@gmail.com',
    phone: '7639109843',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 19000,
    dateOfJoining: '2026-05-07',
  },
  {
    name: 'Mareeswaran J',
    email: 'jsmareeswaran47@gmail.com',
    phone: '6385817055',
    role: 'EMPLOYEE',
    designation: 'Marketing Staff',
    branch: 'WeGrow Skill Campus – Sivakasi Branch 1.0',
    baseSalary: 14000,
    dateOfJoining: '2026-09-16',
  },
  {
    name: 'MUTHUSELVI P',
    email: 'muthuselvip04@gmail.com',
    phone: '9597845037',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 14000,
    dateOfJoining: '2026-05-16',
  },
  {
    name: 'NANDHAKUMAR E',
    email: 'nandhakumar19052005@gmail.com',
    phone: '6369840813',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 5000,
    dateOfJoining: '2026-01-01',
  },
  {
    name: 'Dr.Pandiselvam P',
    email: 'pandiselvam.pps@gmail.com',
    phone: '6381543243',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 8000,
    dateOfJoining: '2026-09-28',
  },
  {
    name: 'RAJAVALLI K',
    email: 'mkrv0617@gmail.com',
    phone: '6382976368',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 13000,
    dateOfJoining: '2026-08-31',
  },
  {
    name: 'Rajkumar A',
    email: 'kumarrk23dev@gmail.com',
    phone: '6380629995',
    role: 'MANAGER',
    designation: 'Manager - Software Developer',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 23000,
    dateOfJoining: '2026-07-13',
  },
  {
    name: 'SHIEK ABDULLA M',
    email: 'www.shiekabdulla78@gmail.com',
    phone: '9094511116',
    role: 'ADMIN',
    designation: 'Incharger',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 23750,
    dateOfJoining: '2026-01-01',
  },
  {
    name: 'SUBHASHINI S',
    email: 'sgssubhashini@gmail.com',
    phone: '9843128769',
    role: 'EMPLOYEE',
    designation: 'Incharger - Enrollment',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 14000,
    dateOfJoining: '2026-07-01',
  },
  {
    name: 'Dr.Thavabalan P',
    email: 'dr.thavabalan@gmail.com',
    phone: '9952337331',
    role: 'MD',
    designation: 'Managing Director',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 143043,
    dateOfJoining: '2026-01-01',
  },
  {
    name: 'Vijayakumar M',
    email: 'vijay909232@gmail.com',
    phone: '9092322803',
    role: 'EMPLOYEE',
    designation: 'Software Developer',
    branch: 'WeGrow B School – Sivakasi Branch 3.0',
    baseSalary: 19000,
    dateOfJoining: '2026-10-01',
  },
  {
    name: 'RAGUL B',
    email: 'euginrahul@gmail.com',
    phone: '7010619201',
    role: 'EMPLOYEE',
    designation: 'Video Editor',
    branch: 'WeGrow Skill Campus – Sivakasi Branch 1.0',
    baseSalary: 12000,
    dateOfJoining: '2026-10-05',
  },

  // Srivilliputhur Branch
  {
    name: 'GEETHA B',
    email: 'geethagurumoorthy93@gmail.com',
    phone: '9344671317',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow Skill Campus – Srivilliputhur Branch 2.0',
    baseSalary: 12000,
    dateOfJoining: '2026-07-10',
  },
  {
    name: 'PRABHAKARAN',
    email: 'prabhu1996prabha@gmail.com',
    phone: '9080118824',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow Skill Campus – Srivilliputhur Branch 2.0',
    baseSalary: 5500,
    dateOfJoining: '2026-09-03',
  },
  {
    name: 'SUJATHA',
    email: 'sujac1991@gmail.com',
    phone: '9080150362',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow Skill Campus – Srivilliputhur Branch 2.0',
    baseSalary: 10000,
    dateOfJoining: '2026-07-13',
  },
  {
    name: 'UMARANI M.s',
    email: 'umarajofficial@gmail.com',
    phone: '7010750916',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow Skill Campus – Srivilliputhur Branch 2.0',
    baseSalary: 19000,
    dateOfJoining: '2026-06-15',
  },
  {
    name: 'VIGNESH A',
    email: 'mfvat.vicky@gmail.com',
    phone: '6374545878',
    role: 'MANAGER',
    designation: 'Branch Manager',
    branch: 'WeGrow Skill Campus – Srivilliputhur Branch 2.0',
    baseSalary: 20000,
    dateOfJoining: '2025-12-22',
  },
  {
    name: 'NAVEEN M',
    email: 'navenn919@gmail.com',
    phone: '9345758711',
    role: 'EMPLOYEE',
    designation: 'Staff',
    branch: 'WeGrow Skill Campus – Srivilliputhur Branch 2.0',
    baseSalary: 12000,
    dateOfJoining: '2026-06-16',
  },
];

function calculateComps(baseSalary) {
  const basic = Math.round(baseSalary * 0.5);
  const hra = Math.round(baseSalary * 0.25);
  const specialAllowance = Math.round(baseSalary * 0.15);
  const otherAllowances = Math.max(0, baseSalary - (basic + hra + specialAllowance));
  const pfDeduction = baseSalary >= 15000 ? Math.min(1800, Math.round(basic * 0.12)) : 0;
  const esiDeduction = baseSalary <= 21000 && baseSalary >= 10000 ? Math.round(baseSalary * 0.0075) : 0;
  const tdsDeduction = baseSalary >= 50000 ? Math.round(baseSalary * 0.05) : 0;
  const netSalary = Math.max(0, baseSalary - (pfDeduction + esiDeduction + tdsDeduction));

  return {
    baseSalary,
    grossSalary: baseSalary,
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

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(dbUrl);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const usersCol = db.collection('users');
  const salaryCol = db.collection('salarystructures');
  const payslipsCol = db.collection('payslips');
  const attendanceCol = db.collection('attendances');

  let syncedCount = 0;

  for (const item of staffData) {
    // 1. Find user by email
    const user = await usersCol.findOne({ email: item.email.toLowerCase() });
    if (!user) {
      console.log(`[USER NOT FOUND] ${item.email}`);
      continue;
    }

    // 2. Update user DOJ, phone, designation, branch
    const cleanPhone = item.phone.replace(/[^0-9]/g, '');
    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          phone: item.phone,
          designation: item.designation,
          branch: item.branch,
          dateOfJoining: new Date(item.dateOfJoining),
        },
      }
    );

    // 3. Upsert Salary Structure
    const comps = calculateComps(item.baseSalary);
    await salaryCol.updateOne(
      { userId: user._id },
      {
        $set: {
          userId: user._id,
          ...comps,
          effectiveFrom: new Date(item.dateOfJoining),
          paymentMode: 'BANK_TRANSFER',
          notes: `Base salary synced from official payroll registry: ₹${item.baseSalary}/mo`,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log(`[SYNCED] ${user.name} (${user.email}) -> Base Salary: ₹${item.baseSalary}, DOJ: ${item.dateOfJoining}`);
    syncedCount++;
  }

  console.log(`\nSuccessfully synchronized ${syncedCount} employees' salary structures & DOJ.`);

  // 4. Generate October 2026 automated payslips for all active users
  console.log('\n--- Generating Automated October 2026 Payslips based on Attendance & DOJ ---');
  const allUsers = await usersCol.find({ isActive: true }).toArray();
  const year = 2026;
  const month = 10;
  const totalDaysInMonth = 31;
  const monthYearStr = 'October 2026';

  let payslipsGenerated = 0;
  for (const u of allUsers) {
    const struct = await salaryCol.findOne({ userId: u._id });
    const baseSalary = struct ? (struct.baseSalary || struct.grossSalary) : 20000;
    const dailyRate = Math.round((baseSalary / totalDaysInMonth) * 100) / 100;

    // Check DOJ pro-rata
    let unjoinedDays = 0;
    if (u.dateOfJoining) {
      const doj = new Date(u.dateOfJoining);
      if (doj.getFullYear() === year && (doj.getMonth() + 1) === month) {
        unjoinedDays = Math.max(0, doj.getDate() - 1);
      }
    }

    // Query attendance records in October 2026
    const atts = await attendanceCol.find({
      userId: u._id,
      date: { $gte: '2026-10-01', $lte: '2026-10-31' },
    }).toArray();

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let lateCount = 0;
    let latePenaltyDays = 0;

    for (const a of atts) {
      if (a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME') presentDays++;
      else if (a.status === 'HALF_DAY') halfDays++;
      else if (a.status === 'ABSENT') absentDays++;

      if (a.isLate) lateCount++;
      if (a.isLatePenaltyApplied) latePenaltyDays += 0.5;
    }

    if (lateCount >= 4 && latePenaltyDays === 0) {
      latePenaltyDays = (lateCount - 3) * 0.5;
    }

    // Loss of pay calculation
    const lopDays = Math.min(totalDaysInMonth, Math.round((unjoinedDays + absentDays + (halfDays * 0.5) + latePenaltyDays) * 10) / 10);
    const paidDays = Math.max(0, Math.round((totalDaysInMonth - lopDays) * 10) / 10);
    const attendanceDeduction = Math.round(dailyRate * lopDays * 100) / 100;

    const pf = struct ? struct.pfDeduction : 0;
    const esi = struct ? struct.esiDeduction : 0;
    const tds = struct ? struct.tdsDeduction : 0;
    const totalDeductions = Math.round((attendanceDeduction + pf + esi + tds) * 100) / 100;
    const netPay = Math.max(0, Math.round((baseSalary - totalDeductions) * 100) / 100);

    await payslipsCol.updateOne(
      { userId: u._id, monthYear: monthYearStr },
      {
        $set: {
          userId: u._id,
          monthYear: monthYearStr,
          month,
          year,
          baseSalary,
          grossPay: baseSalary,
          totalDaysInMonth,
          workingDays: 26,
          presentDays,
          halfDays,
          paidDays,
          absentDays,
          paidLeaves: 0,
          lateCount,
          latePenaltyDays,
          lopDays,
          dailyRate,
          attendanceDeduction,
          pfDeduction: pf,
          esiDeduction: esi,
          tdsDeduction: tds,
          totalDeductions,
          netPay,
          breakdown: {
            basic: struct ? struct.basic : Math.round(baseSalary * 0.5),
            hra: struct ? struct.hra : Math.round(baseSalary * 0.25),
            specialAllowance: struct ? struct.specialAllowance : Math.round(baseSalary * 0.15),
            otherAllowances: struct ? struct.otherAllowances : 0,
            lopDeduction: attendanceDeduction,
            pf,
            esi,
            tds,
          },
          status: 'PAID',
          notes: unjoinedDays > 0 ? `Joined on ${u.dateOfJoining?.toISOString().split('T')[0]}. Pro-rated for ${paidDays} days.` : '',
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    console.log(`[PAYSLIP GENERATED] ${u.name.padEnd(20)} | Base: ₹${String(baseSalary).padEnd(7)} | LOP Days: ${String(lopDays).padEnd(4)} | Deduction: ₹${String(attendanceDeduction).padEnd(8)} | Net Pay: ₹${netPay}`);
    payslipsGenerated++;
  }

  console.log(`\nGenerated ${payslipsGenerated} payslips for ${monthYearStr}.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Error syncing staff salaries:', err);
  process.exit(1);
});
