import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const Demand = mongoose.model('Demand', new mongoose.Schema({}, { strict: false }));
  const Quotation = mongoose.model('Quotation', new mongoose.Schema({}, { strict: false }));
  const Vendor = mongoose.model('Vendor', new mongoose.Schema({}, { strict: false }));
  const Item = mongoose.model('Item', new mongoose.Schema({}, { strict: false }));

  const vendor = await Vendor.findOne({ email: 'sv575014@gmail.com' });
  if (!vendor) {
    console.log('Vendor not found');
    await mongoose.disconnect();
    return;
  }
  console.log('Found Vendor:', vendor.name, vendor._id);

  // 1. Fetch 30 items
  const allItems = await Item.find({}).limit(50);
  console.log('Available items count:', allItems.length);

  // 2. Setup DM-0015 with 25 items
  const dm15Items = allItems.slice(0, 25).map(item => ({
    itemId: item._id,
    name: item.name,
    unit: item.unit || 'KG',
    quantity: Math.floor(Math.random() * 30) + 15
  }));

  const now = new Date();
  const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hrs from now
  const published = new Date(now.getTime() - 2 * 60 * 1000); // 2 mins ago

  await Demand.findOneAndUpdate(
    { demandCode: 'DM-0015' },
    {
      demandCode: 'DM-0015',
      items: dm15Items,
      publishedAt: published,
      deadlineAt: deadline,
      durationHours: 48,
      status: 'Active'
    },
    { upsert: true, new: true }
  );
  console.log('Updated DM-0015 with 25 grocery items');

  // 3. Seed 5 completed demands & quotations for vendor
  const completedConfigs = [
    {
      demandCode: 'DM-0014',
      itemRange: [0, 12],
      daysAgo: 2,
      baseRates: [85, 90, 75, 120, 65, 110, 95, 80, 70, 105, 90, 85]
    },
    {
      demandCode: 'DM-0013',
      itemRange: [5, 13],
      daysAgo: 4,
      baseRates: [110, 95, 80, 70, 105, 90, 85, 60]
    },
    {
      demandCode: 'DM-0012',
      itemRange: [10, 25],
      daysAgo: 7,
      baseRates: [75, 120, 65, 110, 95, 80, 70, 105, 90, 85, 60, 95, 88, 115, 130]
    },
    {
      demandCode: 'DM-0011',
      itemRange: [0, 20],
      daysAgo: 10,
      baseRates: [85, 90, 75, 120, 65, 110, 95, 80, 70, 105, 90, 85, 60, 95, 88, 115, 130, 72, 84, 96]
    },
    {
      demandCode: 'DM-0010',
      itemRange: [15, 25],
      daysAgo: 14,
      baseRates: [90, 85, 60, 95, 88, 115, 130, 72, 84, 96]
    }
  ];

  for (const cfg of completedConfigs) {
    const pubDate = new Date(now.getTime() - cfg.daysAgo * 24 * 60 * 60 * 1000);
    const deadDate = new Date(pubDate.getTime() + 48 * 60 * 60 * 1000);

    const sliceItems = allItems.slice(cfg.itemRange[0], cfg.itemRange[1]);
    const demandItems = sliceItems.map((item, idx) => ({
      itemId: item._id,
      name: item.name,
      unit: item.unit || 'KG',
      quantity: 15 + (idx * 3)
    }));

    const dem = await Demand.findOneAndUpdate(
      { demandCode: cfg.demandCode },
      {
        demandCode: cfg.demandCode,
        items: demandItems,
        publishedAt: pubDate,
        deadlineAt: deadDate,
        durationHours: 48,
        status: 'Completed'
      },
      { upsert: true, new: true }
    );

    // Calculate quotation total
    let total = 0;
    const quotedItems = demandItems.map((dItem, idx) => {
      const rate = cfg.baseRates[idx] || 85;
      total += rate * dItem.quantity;
      return {
        itemId: dItem.itemId,
        name: dItem.name,
        unit: dItem.unit,
        quantity: dItem.quantity,
        rate: rate
      };
    });

    const subDate = new Date(pubDate.getTime() + 6 * 60 * 60 * 1000); // 6 hours after published

    await Quotation.findOneAndUpdate(
      { demandId: dem._id, vendorId: vendor._id },
      {
        demandId: dem._id,
        demandCode: cfg.demandCode,
        vendorId: vendor._id,
        vendorEmail: vendor.email,
        vendorName: vendor.name,
        quotedItems: quotedItems,
        totalQuoteAmount: total,
        submittedAt: subDate
      },
      { upsert: true, new: true }
    );
    console.log('Seeded ' + cfg.demandCode + ' (' + demandItems.length + ' items) - Total: Rs.' + total);
  }

  console.log('Seeding finished successfully!');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
