import Item from '../models/Item.js'

/**
 * Default starter grocery master items list
 */
export const DEFAULT_GROCERY_ITEMS = [
  { name: 'Basmati Rice (Premium)', unit: 'KG', category: 'Grains & Cereals', referencePrice: 85, status: 'Active' },
  { name: 'Wheat Flour (Chakki Atta)', unit: 'KG', category: 'Grains & Cereals', referencePrice: 38, status: 'Active' },
  { name: 'Sugar (Pure Refined)', unit: 'KG', category: 'Sugars & Sweeteners', referencePrice: 44, status: 'Active' },
  { name: 'Cooking Oil (Sunflower Refined)', unit: 'Litre', category: 'Oils & Ghee', referencePrice: 135, status: 'Active' },
  { name: 'Mustard Oil (Kachi Ghani)', unit: 'Litre', category: 'Oils & Ghee', referencePrice: 145, status: 'Active' },
  { name: 'Turmeric Powder (Haldi)', unit: 'KG', category: 'Spices & Masala', referencePrice: 190, status: 'Active' },
  { name: 'Red Chilli Powder (Teja Mirch)', unit: 'KG', category: 'Spices & Masala', referencePrice: 280, status: 'Active' },
  { name: 'Coriander Powder (Dhaniya)', unit: 'KG', category: 'Spices & Masala', referencePrice: 160, status: 'Active' },
  { name: 'Cumin Seeds (Jeera Whole)', unit: 'KG', category: 'Spices & Masala', referencePrice: 340, status: 'Active' },
  { name: 'Mustard Seeds (Rai)', unit: 'KG', category: 'Spices & Masala', referencePrice: 95, status: 'Active' },
  { name: 'Toor Dal (Arhar Fatka)', unit: 'KG', category: 'Pulses & Dals', referencePrice: 160, status: 'Active' },
  { name: 'Moong Dal (Yellow Dhuli)', unit: 'KG', category: 'Pulses & Dals', referencePrice: 115, status: 'Active' },
  { name: 'Chana Dal (Desi)', unit: 'KG', category: 'Pulses & Dals', referencePrice: 88, status: 'Active' },
  { name: 'Urad Dal (White Chilka)', unit: 'KG', category: 'Pulses & Dals', referencePrice: 125, status: 'Active' },
  { name: 'Salt (Tata Vacuum Evaporated)', unit: 'KG', category: 'Daily Essentials', referencePrice: 28, status: 'Active' },
  { name: 'Pure Desi Cow Ghee', unit: 'Litre', category: 'Oils & Ghee', referencePrice: 590, status: 'Active' },
  { name: 'Assam Tea Leaves (Premium CTC)', unit: 'KG', category: 'Beverages', referencePrice: 320, status: 'Active' },
  { name: 'Garam Masala (Special Blend)', unit: 'KG', category: 'Spices & Masala', referencePrice: 420, status: 'Active' },
  { name: 'Black Pepper (Kali Mirch Whole)', unit: 'KG', category: 'Spices & Masala', referencePrice: 650, status: 'Active' },
  { name: 'Kabuli Chana (Big Size)', unit: 'KG', category: 'Pulses & Dals', referencePrice: 140, status: 'Active' },
  { name: 'Rajma (Chitra Special)', unit: 'KG', category: 'Pulses & Dals', referencePrice: 130, status: 'Active' },
  { name: 'Besan (Gram Flour)', unit: 'KG', category: 'Grains & Cereals', referencePrice: 95, status: 'Active' },
  { name: 'Maida (All Purpose Flour)', unit: 'KG', category: 'Grains & Cereals', referencePrice: 40, status: 'Active' },
  { name: 'Suji / Rawa (Semolina)', unit: 'KG', category: 'Grains & Cereals', referencePrice: 42, status: 'Active' }
]

/**
 * @desc    Get all items with search, category filter, and optional pagination
 * @route   GET /api/items
 * @access  Private (Admin)
 */
export const getItems = async (req, res) => {
  try {
    const { search, category, status, page, limit, all } = req.query
    const query = {}

    // Search by name
    if (search && search.trim()) {
      query.name = new RegExp(search.trim(), 'i')
    }

    // Category filter
    if (category && category !== 'All') {
      query.category = category
    }

    // Status filter
    if (status && status !== 'All') {
      query.status = status
    }

    const totalCount = await Item.countDocuments(query)

    // If 'all=true' is passed, return full unpaginated list (used by demand selection)
    if (all === 'true') {
      const items = await Item.find(query).sort({ name: 1 })
      return res.json({
        success: true,
        count: items.length,
        total: totalCount,
        data: items
      })
    }

    const pageNum = parseInt(page, 10) || 1
    const limitNum = parseInt(limit, 10) || 10
    const skip = (pageNum - 1) * limitNum

    const items = await Item.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)

    res.json({
      success: true,
      count: items.length,
      total: totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      data: items
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get single item by ID
 * @route   GET /api/items/:id
 * @access  Private (Admin)
 */
export const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, message: 'Grocery item not found' })
    }
    res.json({ success: true, data: item })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Create a new grocery item
 * @route   POST /api/items
 * @access  Private (Admin)
 */
export const createItem = async (req, res) => {
  try {
    const { name, unit, category, referencePrice, status } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Item name is required' })
    }

    if (!unit || !unit.trim()) {
      return res.status(400).json({ success: false, message: 'Item unit is required (e.g. KG, Litre)' })
    }

    const trimmedName = name.trim()

    // Case-insensitive duplicate check
    const existing = await Item.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') })
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Grocery item '${trimmedName}' is already registered in Item Master`
      })
    }

    const item = await Item.create({
      name: trimmedName,
      unit: unit.trim(),
      category: category && category.trim() ? category.trim() : 'Grains & Cereals',
      referencePrice: Number(referencePrice) || 0,
      status: status || 'Active',
      isActive: status !== 'Inactive'
    })

    res.status(201).json({
      success: true,
      message: 'Grocery item added to master list',
      data: item
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Update existing grocery item
 * @route   PUT /api/items/:id
 * @access  Private (Admin)
 */
export const updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, message: 'Grocery item not found' })
    }

    const { name, unit, category, referencePrice, status } = req.body

    if (name && name.trim()) {
      const trimmedName = name.trim()
      // Check duplicate against other items
      const existing = await Item.findOne({
        _id: { $ne: item._id },
        name: new RegExp(`^${trimmedName}$`, 'i')
      })
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Another item with name '${trimmedName}' already exists`
        })
      }
      item.name = trimmedName
    }

    if (unit) item.unit = unit.trim()
    if (category) item.category = category.trim()
    if (referencePrice !== undefined) item.referencePrice = Number(referencePrice) || 0
    if (status) {
      item.status = status
      item.isActive = status === 'Active'
    }

    const updatedItem = await item.save()

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: updatedItem
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Delete grocery item
 * @route   DELETE /api/items/:id
 * @access  Private (Admin)
 */
export const deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ success: false, message: 'Grocery item not found' })
    }

    await Item.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: `Item '${item.name}' deleted successfully`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Bulk Import Items (From Excel / CSV)
 * @route   POST /api/items/bulk-import
 * @access  Private (Admin)
 */
export const bulkImportItems = async (req, res) => {
  try {
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid array of items to import'
      })
    }

    let addedCount = 0
    let updatedCount = 0
    const errors = []

    for (const [index, row] of items.entries()) {
      let rawName = row.name || row.itemName || row['Item Name'] || ''
      rawName = String(rawName).trim()
      if (!rawName) {
        errors.push(`Row ${index + 1}: Item name is required`)
        continue
      }

      const packSize = String(row.packSize || row.packagingType || row['Packaging Type / Pack Size'] || '').trim()
      const specifications = String(row.specifications || row.specs || row['Essential Specifications & Quality Standards'] || '').trim()
      
      // If packSize is present and not already enclosed in name, format as: Name (PackSize)
      let name = rawName
      if (packSize && !name.toLowerCase().includes(packSize.toLowerCase())) {
        name = `${rawName} (${packSize})`
      }

      // Determine unit from packSize if not explicitly given
      let unit = String(row.unit || row.Unit || '').trim()
      if (!unit && packSize) {
        const lowerPack = packSize.toLowerCase()
        if (lowerPack.includes('kg')) unit = 'KG'
        else if (lowerPack.includes('gm') || lowerPack.includes('gram')) unit = 'Gram'
        else if (lowerPack.includes('l') || lowerPack.includes('litre') || lowerPack.includes('ml')) unit = 'Litre'
        else if (lowerPack.includes('pack')) unit = 'Packet'
        else if (lowerPack.includes('bag')) unit = 'Bag'
        else if (lowerPack.includes('tin')) unit = 'Tin'
        else if (lowerPack.includes('jar')) unit = 'Jar'
        else if (lowerPack.includes('bar')) unit = 'Piece'
        else unit = 'Packet'
      }
      if (!unit) unit = 'KG'

      const category = String(row.category || row.Category || 'General Grocery').trim()
      const referencePrice = Number(row.referencePrice || row.price || row.rate || row['Rates per Pack (₹)']) || 0
      const status = row.status === 'Inactive' ? 'Inactive' : 'Active'

      const existing = await Item.findOne({ name: new RegExp(`^${name}$`, 'i') })

      if (existing) {
        existing.unit = unit
        existing.category = category
        existing.packSize = packSize || existing.packSize
        existing.specifications = specifications || existing.specifications
        if (referencePrice > 0) existing.referencePrice = referencePrice
        existing.status = status
        existing.isActive = status === 'Active'
        await existing.save()
        updatedCount++
      } else {
        await Item.create({
          name,
          unit,
          category,
          packSize,
          specifications,
          referencePrice,
          status,
          isActive: status === 'Active'
        })
        addedCount++
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${addedCount} new items, updated ${updatedCount} items`,
      addedCount,
      updatedCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Seed default master grocery items if database is empty
 * @route   POST /api/items/seed
 * @access  Private (Admin)
 */
export const seedDefaultItems = async (req, res) => {
  try {
    const existingCount = await Item.countDocuments()
    if (existingCount > 0) {
      return res.json({
        success: true,
        message: `Database already contains ${existingCount} items. Seed skipped.`
      })
    }

    const inserted = await Item.insertMany(DEFAULT_GROCERY_ITEMS)

    res.status(201).json({
      success: true,
      message: `Successfully seeded ${inserted.length} default grocery items!`,
      count: inserted.length,
      data: inserted
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
