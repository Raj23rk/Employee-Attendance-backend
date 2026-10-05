require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userCredentials = [
  { email: 'dr.thavabalan@gmail.com', employeeId: 'WG26001', password: 'WG@Tha7!Nx58' },
  { email: 'lakshmipriya@psr.edu.in', employeeId: 'WG26002', password: 'WG@Lak5$Rt39' },
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
  { email: 'pandiselvam.pps@gmail.com', password: 'WG@Pan8$Hm25' },
  { email: 'ajithkumar.bba.anjac@gmail.com', password: 'WG@Aji4#Qx82' }
];

// Helper to generate a password following the pattern: WG@<3 letters><1 digit><symbol><2 letters><2 digits>
function generateEmployeePassword(nameOrEmail) {
  const cleanName = (nameOrEmail.split('@')[0] || 'Emp').replace(/[^a-zA-Z]/g, '');
  const prefix = (cleanName.slice(0, 1).toUpperCase() + cleanName.slice(1, 3).toLowerCase()).padEnd(3, 'x');
  const digit1 = Math.floor(Math.random() * 9) + 1;
  const symbols = ['#', '!', '$'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const l1 = letters[Math.floor(Math.random() * 26)]; // Uppercase
  const l2 = letters[26 + Math.floor(Math.random() * 26)]; // Lowercase
  const digits2 = Math.floor(10 + Math.random() * 90);

  return `WG@${prefix}${digit1}${symbol}${l1}${l2}${digits2}`;
}

async function updatePasswordsInDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(dbUrl);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');

  let updatedCount = 0;
  for (const item of userCredentials) {
    const hashedPassword = await bcrypt.hash(item.password, 10);
    const query = {
      $or: [
        { email: item.email.toLowerCase() },
        ...(item.employeeId ? [{ employeeId: item.employeeId }] : [])
      ]
    };
    const result = await usersCollection.updateOne(
      query,
      { $set: { password: hashedPassword } }
    );

    if (result.matchedCount > 0) {
      console.log(`[UPDATED] ${item.email} (${item.employeeId || 'no empId'}) -> ${item.password}`);
      updatedCount++;
    } else {
      console.log(`[NOT FOUND IN DB] ${item.email} (${item.employeeId || 'no empId'}) (Password: ${item.password})`);
    }
  }

  console.log(`\nCompleted. Updated ${updatedCount}/${userCredentials.length} users.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  updatePasswordsInDatabase().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { generateEmployeePassword, userCredentials };
