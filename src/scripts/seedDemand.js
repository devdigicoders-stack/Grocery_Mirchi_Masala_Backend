import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const items = await mongoose.connection.db.collection('items').find({}).limit(6).toArray();
  
  const now = new Date();
  const deadline = new Date(now.getTime() + 47 * 60 * 60 * 1000 + 59 * 60 * 1000 + 32 * 1000); // 47h 59m 32s

  const demandItems = items.map(item => ({
    itemId: item._id,
    name: item.name,
    unit: item.unit || 'KG',
    quantity: Math.floor(Math.random() * 50) + 10
  }));

  const demandDoc = {
    demandCode: 'DM-0015',
    items: demandItems,
    publishedAt: now,
    deadlineAt: deadline,
    durationHours: 48,
    status: 'Active',
    createdAt: now,
    updatedAt: now
  };

  await mongoose.connection.db.collection('demands').updateOne(
    { demandCode: 'DM-0015' },
    { $set: demandDoc },
    { upsert: true }
  );

  console.log('DM-0015 created successfully in DB!');
  await mongoose.disconnect();
}
run();
