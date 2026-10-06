require('dotenv').config();
const mongoose = require('mongoose');

async function fixStaleCheckouts() {
  const dbUrl = process.env.DATABASE_URL || 'mongodb+srv://Raj:iT3Wqx0axmZv1dHI@cluster0.86ttxfk.mongodb.net/Attendence_management?appName=Cluster0';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(dbUrl);
  console.log('Connected.');

  const collection = mongoose.connection.db.collection('attendances');

  // Find all attendances where checkOutTime <= checkInTime
  const allAtts = await collection.find({}).toArray();
  let fixedCount = 0;

  for (const att of allAtts) {
    if (att.checkInTime && att.checkOutTime) {
      const inTime = new Date(att.checkInTime).getTime();
      const outTime = new Date(att.checkOutTime).getTime();

      if (outTime <= inTime) {
        await collection.updateOne(
          { _id: att._id },
          { 
            $unset: { checkOutTime: "", checkOutLocation: "" },
            $set: { totalWorkingMinutes: 0 }
          }
        );
        console.log(`[FIXED STALE CHECKOUT] Date: ${att.date}, User: ${att.userId}, In: ${att.checkInTime}, Old Out: ${att.checkOutTime}`);
        fixedCount++;
      }
    }
  }

  console.log(`\nFixed ${fixedCount} stale check-out records in database!`);
  await mongoose.disconnect();
}

fixStaleCheckouts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
