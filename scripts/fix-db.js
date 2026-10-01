require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userCredentials = [
  { email: 'ak45ashokkumar@gmail.com', password: 'WG@Aka5#Rx93' },
  { email: 'srisaigopi31@gmail.com', password: 'WG@Sri7!Qp46' },
  { email: 'kumarrk23dev@gmail.com', password: 'WG@Kum2$Yx85' },
  { email: 'mkrv0617@gmail.com', password: 'WG@Mkr6#Ln38' },
  { email: 'lakshmipriya.srbe@gmail.com', password: 'WG@Lak4!Qz71' },
  { email: 'muthuselvip04@gmail.com', password: 'WG@Mut9$Kr26' },
  { email: 'sgssubhashini@gmail.com', password: 'WG@Sgs5#Wp84' },
  { email: 'devisudalai2003@gmail.com', password: 'WG@Dev8!Mx39' },
  { email: 'jsmareeswaran47@gmail.com', password: 'WG@Jsm3$Qn67' },
  { email: 'mfvat.vicky@gmail.com', password: 'WG@Mfv7#Rt42' },
  { email: 'geethagurumoorthy93@gmail.com', password: 'WG@Gee6!Xp58' },
  { email: 'umarajofficial@gmail.com', password: 'WG@Uma8#Lp47' },
  { email: 'sujac1991@gmail.com', password: 'WG@Suj4!Nx82' },
  { email: 'navenn919@gmail.com', password: 'WG@Nav6$Qr31' },
  { email: 'prabhu1996prabha@gmail.com', password: 'WG@Pra9#Tk54' },
  { email: 'nandhakumar19052005@gmail.com', password: 'WG@Nan3!Vz76' },
  { email: 'pandiselvam.pps@gmail.com', password: 'WG@Pan8$Hm25' }
];

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
      const [d, m, y] = s.split('-');
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000Z`);
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000Z`);
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function fix() {
  const dbUrl = process.env.DATABASE_URL || 'mongodb+srv://Raj:iT3Wqx0axmZv1dHI@cluster0.86ttxfk.mongodb.net/Attendence_management?appName=Cluster0';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(dbUrl);
  console.log('Connected.');

  const collection = mongoose.connection.db.collection('users');
  
  // 1. Fix dateOfBirth and dateOfJoining
  const users = await collection.find({}).toArray();
  for (const u of users) {
    const parsedDOB = parseDate(u.dateOfBirth);
    const parsedDOJ = parseDate(u.dateOfJoining);
    await collection.updateOne(
      { _id: u._id },
      { $set: { dateOfBirth: parsedDOB, dateOfJoining: parsedDOJ } }
    );
    console.log(`[DATE FIXED] ${u.email} -> DOB: ${parsedDOB ? parsedDOB.toISOString().split('T')[0] : null}, DOJ: ${parsedDOJ ? parsedDOJ.toISOString().split('T')[0] : null}`);
  }

  // 2. Update passwords to bcrypt hashes
  for (const item of userCredentials) {
    const hashed = await bcrypt.hash(item.password, 10);
    const res = await collection.updateOne(
      { email: item.email.toLowerCase() },
      { $set: { password: hashed, isActive: true } }
    );
    if (res.matchedCount > 0) {
      console.log(`[PASSWORD UPDATED] ${item.email}`);
    } else {
      console.log(`[USER NOT FOUND] ${item.email}`);
    }
  }

  console.log('\nAll user dates and passwords successfully synchronized in MongoDB!');
  await mongoose.disconnect();
}

fix().catch(err => {
  console.error('Error during fix:', err);
  process.exit(1);
});
