require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// Shift timings definition:
// 1. Mareeswaran J: 10:00 AM to 8:00 PM (10:00 to 20:00)
// 2. NANDHAKUMAR E: 5:00 PM to 9:00 PM (17:00 to 21:00)
// 3. Dr.Pandiselvam P: 6:30 PM to 9:00 PM (18:30 to 21:00)
// 4. RAGUL B: 9:40 AM to 7:30 PM (09:40 to 19:30)
// 5. GEETHA B: 9:40 AM to 5:40 PM (09:40 to 17:40)
// 6. PRABHAKARAN: 6:00 PM to 9:00 PM (18:00 to 21:00)
// 7. SUJATHA: 10:00 AM to 1:00 PM (10:00 to 13:00)
// 8. NAVEEN M: remove (isActive: false)
// 9. Remaining people: 9:40 AM to 7:00 PM (09:40 to 19:00)

const SPECIAL_SHIFTS = [
  {
    nameMatch: 'Mareeswaran',
    email: 'jsmareeswaran47@gmail.com',
    shiftStartTime: '10:00',
    shiftEndTime: '20:00',
    gracePeriodMinutes: 5,
  },
  {
    nameMatch: 'NANDHAKUMAR',
    email: 'nandhakumar19052005@gmail.com',
    shiftStartTime: '17:00',
    shiftEndTime: '21:00',
    gracePeriodMinutes: 5,
  },
  {
    nameMatch: 'Pandiselvam',
    email: 'pandiselvam.pps@gmail.com',
    shiftStartTime: '18:30',
    shiftEndTime: '21:00',
    gracePeriodMinutes: 5,
  },
  {
    nameMatch: 'RAGUL',
    email: 'euginrahul@gmail.com',
    shiftStartTime: '09:40',
    shiftEndTime: '19:30',
    gracePeriodMinutes: 5,
  },
  {
    nameMatch: 'GEETHA',
    email: 'geethagurumoorthy93@gmail.com',
    shiftStartTime: '09:40',
    shiftEndTime: '17:40',
    gracePeriodMinutes: 5,
  },
  {
    nameMatch: 'PRABHAKARAN',
    email: 'prabhu1996prabha@gmail.com',
    shiftStartTime: '18:00',
    shiftEndTime: '21:00',
    gracePeriodMinutes: 5,
  },
  {
    nameMatch: 'SUJATHA',
    email: 'sujac1991@gmail.com',
    shiftStartTime: '10:00',
    shiftEndTime: '13:00',
    gracePeriodMinutes: 5,
  },
];

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  console.log('Connecting to database...');
  await mongoose.connect(dbUrl);
  console.log('Connected to MongoDB.');

  const usersCol = mongoose.connection.db.collection('users');
  const attendanceCol = mongoose.connection.db.collection('attendances');

  // 1. Deactivate / Remove NAVEEN M
  console.log('\n--- 1. Removing NAVEEN M ---');
  const naveenRes = await usersCol.updateOne(
    {
      $or: [
        { email: 'navenn919@gmail.com' },
        { name: { $regex: 'NAVEEN', $options: 'i' } }
      ]
    },
    { $set: { isActive: false, updatedAt: new Date() } }
  );
  console.log(`Deactivated NAVEEN M (matched: ${naveenRes.matchedCount}, modified: ${naveenRes.modifiedCount})`);

  // 2. Set default shifts for ALL active users: 09:40 to 19:00
  console.log('\n--- 2. Setting Default Shift (09:40 to 19:00) for all users ---');
  const defaultRes = await usersCol.updateMany(
    {},
    {
      $set: {
        shiftStartTime: '09:40',
        shiftEndTime: '19:00',
        gracePeriodMinutes: 5,
      }
    }
  );
  console.log(`Default shift applied to ${defaultRes.modifiedCount} users.`);

  // 3. Apply custom shifts for specific employees
  console.log('\n--- 3. Applying Custom Individual Shifts ---');
  for (const shift of SPECIAL_SHIFTS) {
    const res = await usersCol.updateOne(
      {
        $or: [
          { email: shift.email },
          { name: { $regex: shift.nameMatch, $options: 'i' } }
        ]
      },
      {
        $set: {
          shiftStartTime: shift.shiftStartTime,
          shiftEndTime: shift.shiftEndTime,
          gracePeriodMinutes: shift.gracePeriodMinutes,
          updatedAt: new Date(),
        }
      }
    );
    console.log(`Applied shift [${shift.shiftStartTime} - ${shift.shiftEndTime}] for ${shift.nameMatch} (matched: ${res.matchedCount})`);
  }

  // 4. Verify all active users and their shifts
  console.log('\n--- 4. Active Staff and Assigned Shifts ---');
  const activeUsers = await usersCol.find({ isActive: true }).sort({ name: 1 }).toArray();
  for (const u of activeUsers) {
    console.log(`- ${u.name.padEnd(20)} | Shift: ${u.shiftStartTime} to ${u.shiftEndTime} | Grace: ${u.gracePeriodMinutes || 5}m | Email: ${u.email}`);
  }

  // 5. Recalculate today's (2026-11-02) attendance based on new rules
  console.log("\n--- 5. Recalculating Today's (2026-11-02) Attendance Records ---");
  const todayAtts = await attendanceCol.find({ date: '2026-11-02' }).toArray();
  const userMap = new Map(activeUsers.map(u => [u._id.toString(), u]));

  for (const att of todayAtts) {
    const u = userMap.get(att.userId.toString());
    if (!u) continue;

    if (!att.checkInTime) continue;

    const punchIn = new Date(att.checkInTime);
    const istTimeStr = punchIn.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const [punchH, punchM] = istTimeStr.split(':').map(Number);
    const punchTotalMins = punchH * 60 + punchM;

    const [startH, startM] = (u.shiftStartTime || '09:40').split(':').map(Number);
    const shiftStartTotalMins = (startH || 9) * 60 + (startM || 40);
    const shiftGraceTotalMins = shiftStartTotalMins + (u.gracePeriodMinutes || 5);

    let isLate = false;
    let isGraceCheckIn = false;
    let graceCountThisMonth = 0;
    let lateMinutes = 0;
    let lateCountThisMonth = 0;
    let isLatePenaltyApplied = false;
    let latePenaltyType = 'NONE';
    let status = 'PRESENT';

    if (punchTotalMins <= shiftStartTotalMins) {
      isLate = false;
      lateMinutes = 0;
      isGraceCheckIn = false;
      status = 'PRESENT';
    } else if (punchTotalMins <= shiftGraceTotalMins) {
      // Within 5 min grace window
      lateMinutes = punchTotalMins - shiftStartTotalMins;
      isGraceCheckIn = true;
      graceCountThisMonth = 1; // 1st grace used this month (Nov 2)
      isLate = false;
      status = 'PRESENT';
    } else {
      // Past grace
      isLate = true;
      isGraceCheckIn = false;
      lateMinutes = punchTotalMins - shiftStartTotalMins;
      lateCountThisMonth = 1;
      status = 'PRESENT';
    }

    const notes = isLate
      ? `Late check-in (${lateMinutes}m late. Late arrival #1/3 allowed)`
      : isGraceCheckIn
        ? `On-time check-in (Grace used: 1/3 allowed)`
        : 'On-time check-in';

    await attendanceCol.updateOne(
      { _id: att._id },
      {
        $set: {
          shiftStartTime: u.shiftStartTime,
          shiftEndTime: u.shiftEndTime,
          isLate,
          isGraceCheckIn,
          graceCountThisMonth,
          lateMinutes,
          lateCountThisMonth,
          isLatePenaltyApplied,
          latePenaltyType,
          status,
          notes,
          updatedAt: new Date(),
        }
      }
    );

    console.log(`Updated today attendance for ${u.name}: punch ${istTimeStr} -> isLate: ${isLate}, isGrace: ${isGraceCheckIn}, lateMins: ${lateMinutes}`);
  }

  console.log('\nMigration and update completed successfully!');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error executing script:', err);
  process.exit(1);
});
