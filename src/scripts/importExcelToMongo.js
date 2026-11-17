import dotenv from 'dotenv'
import mongoose from 'mongoose'
import xlsx from 'xlsx'
import Item from '../models/Item.js'

dotenv.config()

async function importInventory() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected to MongoDB successfully.')

    const excelPath = 'd:/Desktop/Groccery_shop/admin/Grocery_Master_Inventory-4 (1).xlsx'
    const workbook = xlsx.readFile(excelPath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 })

    let currentCategory = 'General Grocery'
    const parsedItems = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0) continue

      // Section header row
      if (
        typeof row[0] === 'string' &&
        isNaN(Number(row[0])) &&
        (row[1] === undefined || row[1] === null || row[1] === '')
      ) {
        currentCategory = row[0].trim()
        continue
      }

      if (isNaN(Number(row[0]))) continue

      const rawItemName = String(row[1] || '').trim()
      if (!rawItemName) continue

      const packSize = String(row[2] || '').trim()
      const specs = String(row[4] || '').trim()
      const rate = Number(row[5]) || 0

      // Full display name with packaging specification
      const fullName = packSize ? `${rawItemName} (${packSize})` : rawItemName

      // Standardize clean category name
      let cleanCategory = currentCategory
        .replace(/\(.*?\)/g, '')
        .trim()
      if (!cleanCategory) cleanCategory = currentCategory

      // Derive unit
      let unit = 'KG'
      const lowerPack = packSize.toLowerCase()
      if (lowerPack.includes('kg')) unit = 'KG'
      else if (lowerPack.includes('gm') || lowerPack.includes('gram')) unit = 'Gram'
      else if (lowerPack.includes('l') || lowerPack.includes('litre') || lowerPack.includes('ml')) unit = 'Litre'
      else if (lowerPack.includes('pack')) unit = 'Packet'
      else if (lowerPack.includes('bag')) unit = 'Bag'
      else if (lowerPack.includes('tin')) unit = 'Tin'
      else if (lowerPack.includes('jar')) unit = 'Jar'
      else if (lowerPack.includes('bar')) unit = 'Piece'

      parsedItems.push({
        sno: Number(row[0]),
        name: fullName,
        unit,
        category: cleanCategory,
        packSize,
        specifications: specs,
        referencePrice: rate,
        status: 'Active',
        isActive: true
      })
    }

    console.log(`Parsed ${parsedItems.length} items from Excel sheet. Starting MongoDB import...`)

    let addedCount = 0
    let updatedCount = 0

    for (const item of parsedItems) {
      const existing = await Item.findOne({ name: item.name })
      if (existing) {
        existing.unit = item.unit
        existing.category = item.category
        existing.packSize = item.packSize
        existing.specifications = item.specifications
        if (item.referencePrice > 0) existing.referencePrice = item.referencePrice
        existing.status = 'Active'
        existing.isActive = true
        await existing.save()
        updatedCount++
      } else {
        await Item.create(item)
        addedCount++
      }
    }

    const totalInDb = await Item.countDocuments()

    console.log('--------------------------------------------------')
    console.log(`IMPORT COMPLETE:`)
    console.log(`- New Items Created: ${addedCount}`)
    console.log(`- Existing Items Updated: ${updatedCount}`)
    console.log(`- Total Inventory Items in MongoDB: ${totalInDb}`)
    console.log('--------------------------------------------------')

    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
    process.exit(0)
  } catch (error) {
    console.error('Import failed with error:', error)
    process.exit(1)
  }
}

importInventory()
