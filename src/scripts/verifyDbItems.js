import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Item from '../models/Item.js'

dotenv.config()

async function verify() {
  await mongoose.connect(process.env.MONGO_URI)
  const total = await Item.countDocuments()
  const active = await Item.countDocuments({ status: 'Active' })
  const categories = await Item.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
  console.log('Total Items in MongoDB:', total)
  console.log('Active Items in MongoDB:', active)
  console.log('Category breakdown in MongoDB:', categories)
  const sample = await Item.find().limit(5).lean()
  console.log('Sample Items:', sample.map((s) => ({ name: s.name, unit: s.unit, cat: s.category, pack: s.packSize })))
  await mongoose.disconnect()
}

verify()
