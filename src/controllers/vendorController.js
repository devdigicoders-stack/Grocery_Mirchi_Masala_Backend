import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Vendor from '../models/Vendor.js'
import Demand from '../models/Demand.js'
import Quotation from '../models/Quotation.js'
import Order from '../models/Order.js'
import EmailLog from '../models/EmailLog.js'
import { generateToken } from '../middlewares/authMiddleware.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * @desc    Get all vendors with optional search & filter
 * @route   GET /api/vendors
 * @access  Private (Admin)
 */
export const getVendors = async (req, res) => {
  try {
    const { search, status } = req.query
    const query = {}

    // Filter by search query (name, email, or phone)
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i')
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
    }

    // Filter by status (Active / Inactive)
    if (status && status !== 'All') {
      query.status = status
    }

    const vendors = await Vendor.find(query).sort({ createdAt: -1 })
    res.json({
      success: true,
      count: vendors.length,
      data: vendors
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get single vendor by ID
 * @route   GET /api/vendors/:id
 * @access  Private (Admin)
 */
export const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }
    res.json({ success: true, data: vendor })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Create / Register a new Vendor (with password and optional profile image)
 * @route   POST /api/vendors
 * @access  Private (Admin)
 */
export const createVendor = async (req, res) => {
  try {
    const { name, email, password, phone, address, status } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Vendor name is required' })
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Vendor email (Login ID) is required' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if email already registered
    const existingVendor = await Vendor.findOne({ email: normalizedEmail })
    if (existingVendor) {
      // If a file was uploaded, clean it up since creation failed
      if (req.file) {
        try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
      }
      return res.status(400).json({
        success: false,
        message: `Vendor with email '${normalizedEmail}' is already registered`
      })
    }

    // Handle profile image from multer upload or direct path
    let profileImage = ''
    if (req.file) {
      profileImage = `/uploads/vendors/${req.file.filename}`
    } else if (req.body.profileImage) {
      profileImage = req.body.profileImage
    }

    // Password: User requirement states password should be visible and not hashed
    const vendorPassword = password && password.trim() ? password.trim() : 'vendor123'

    const vendor = await Vendor.create({
      name: name.trim(),
      email: normalizedEmail,
      password: vendorPassword,
      profileImage,
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      status: status || 'Active'
    })

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: vendor
    })
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
    }
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Update Vendor Details (name, email, password, phone, address, profile image, status)
 * @route   PUT /api/vendors/:id
 * @access  Private (Admin)
 */
export const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
      }
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    const { name, email, password, phone, address, status } = req.body

    // Check if updating to an email that belongs to another vendor
    if (email && email.toLowerCase().trim() !== vendor.email) {
      const normalizedEmail = email.toLowerCase().trim()
      const emailExists = await Vendor.findOne({ email: normalizedEmail })
      if (emailExists) {
        if (req.file) {
          try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
        }
        return res.status(400).json({
          success: false,
          message: `Email '${normalizedEmail}' is already in use by another vendor`
        })
      }
      vendor.email = normalizedEmail
    }

    if (name) vendor.name = name.trim()
    if (password && password.trim()) vendor.password = password.trim()
    if (phone !== undefined) vendor.phone = phone.trim()
    if (address !== undefined) vendor.address = address.trim()
    if (status) vendor.status = status

    // Handle new profile image upload
    if (req.file) {
      // Remove old image file if it exists in uploads/vendors
      if (vendor.profileImage && vendor.profileImage.startsWith('/uploads/vendors/')) {
        const oldFilePath = path.join(__dirname, '../../', vendor.profileImage)
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath) } catch (e) { /* ignore */ }
        }
      }
      vendor.profileImage = `/uploads/vendors/${req.file.filename}`
    } else if (req.body.profileImage !== undefined) {
      vendor.profileImage = req.body.profileImage
    }

    const updatedVendor = await vendor.save()

    res.json({
      success: true,
      message: 'Vendor updated successfully',
      data: updatedVendor
    })
  } catch (error) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path) } catch (e) { /* ignore */ }
    }
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Delete a Vendor
 * @route   DELETE /api/vendors/:id
 * @access  Private (Admin)
 */
export const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    // Delete image file if exists
    if (vendor.profileImage && vendor.profileImage.startsWith('/uploads/vendors/')) {
      const filePath = path.join(__dirname, '../../', vendor.profileImage)
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath) } catch (e) { /* ignore */ }
      }
    }

    await Vendor.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: `Vendor '${vendor.name}' deleted successfully`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Send APK invite link to a specific vendor
 * @route   POST /api/vendors/:id/send-invite
 * @access  Private (Admin)
 */
export const sendVendorApkInvite = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    // In production, integrate Email/SMS/WhatsApp dispatch here
    vendor.lastInviteSentAt = new Date()
    await vendor.save()

    // Log to EmailLog
    await EmailLog.create({
      vendorId: vendor._id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      demandCode: 'General',
      emailType: 'APK App Invite',
      subject: 'Mirch Masala Grocery Shop - Vendor B2B App Download Link & Credentials',
      content: `Dear ${vendor.name},\n\nPlease find your access to the Mirch Masala B2B Reverse Auction Android App.\nLogin Email: ${vendor.email}\nApp Password: ${vendor.password}\nDownload APK: https://mirchmasala.com/downloads/vendor-app.apk\n\nRegards,\nMirch Masala Team`,
      status: 'Sent'
    }).catch(() => null)

    res.json({
      success: true,
      message: `APK invite & credentials (Email: ${vendor.email}, Password: ${vendor.password}) sent to ${vendor.name}`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Send APK invite link to all active vendors
 * @route   POST /api/vendors/send-bulk-invite
 * @access  Private (Admin)
 */
export const sendBulkApkInvite = async (req, res) => {
  try {
    const activeVendors = await Vendor.find({ status: 'Active' })
    if (activeVendors.length === 0) {
      return res.status(400).json({ success: false, message: 'No active vendors found to invite' })
    }

    await Vendor.updateMany({ status: 'Active' }, { lastInviteSentAt: new Date() })

    // Log to EmailLog for each vendor
    for (const v of activeVendors) {
      await EmailLog.create({
        vendorId: v._id,
        vendorName: v.name,
        vendorEmail: v.email,
        demandCode: 'General',
        emailType: 'APK App Invite',
        subject: 'Mirch Masala Grocery Shop - Vendor B2B App Download Link & Credentials',
        content: `Dear ${v.name},\n\nPlease find your access to the Mirch Masala B2B Reverse Auction Android App.\nLogin Email: ${v.email}\nApp Password: ${v.password}\nDownload APK: https://mirchmasala.com/downloads/vendor-app.apk\n\nRegards,\nMirch Masala Team`,
        status: 'Sent'
      }).catch(() => null)
    }

    res.json({
      success: true,
      message: `APK download link successfully dispatched to all ${activeVendors.length} active vendors`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Vendor Mobile App Login (Email + Plain Password)
 * @route   POST /api/vendors/login
 * @access  Public (For Flutter Android App)
 */
export const vendorLogin = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const vendor = await Vendor.findOne({ email: normalizedEmail })

    if (!vendor) {
      return res.status(401).json({ success: false, message: 'Invalid vendor email or password' })
    }

    if (vendor.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact Admin.' })
    }

    // Direct plain password comparison as requested
    if (vendor.password !== password.trim()) {
      return res.status(401).json({ success: false, message: 'Invalid vendor email or password' })
    }

    const token = generateToken(vendor._id, 'vendor')

    res.json({
      success: true,
      message: 'Vendor login successful',
      token,
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        profileImage: vendor.profileImage,
        status: vendor.status
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Current Vendor Profile
 * @route   GET /api/vendors/profile
 * @access  Private (Vendor)
 */
export const getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id).select('-password')
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    // Also get quick stats for the vendor
    const totalQuotes = await Quotation.countDocuments({ vendorId: req.vendor._id })
    const wonOrders = await Order.countDocuments({ vendorId: req.vendor._id })

    res.json({
      success: true,
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone || '',
        address: vendor.address || '',
        profileImage: vendor.profileImage || '',
        status: vendor.status || 'Active',
        createdAt: vendor.createdAt
      },
      stats: {
        totalQuotes,
        wonOrders
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Update Current Vendor Profile (name, phone, address, password, profileImage)
 * @route   PUT /api/vendors/profile
 * @access  Private (Vendor)
 */
export const updateVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendor._id)
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    const { name, phone, address, password, profileImageBase64 } = req.body

    const oldName = vendor.name

    if (name && name.trim()) vendor.name = name.trim()
    if (phone !== undefined) vendor.phone = phone.trim()
    if (address !== undefined) vendor.address = address.trim()
    if (password && password.trim()) vendor.password = password.trim()

    // 1. Handle uploaded image via Multer
    if (req.file) {
      // Remove old uploaded image if exists
      if (vendor.profileImage && vendor.profileImage.startsWith('/uploads/vendors/')) {
        try {
          const oldFilePath = path.join(__dirname, '../../', vendor.profileImage)
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath)
        } catch (_) { /* ignore */ }
      }
      vendor.profileImage = `/uploads/vendors/${req.file.filename}`
    } else if (profileImageBase64 && profileImageBase64.trim()) {
      // 2. Handle base64 image data
      try {
        const matches = profileImageBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
        const base64Data = matches ? matches[2] : profileImageBase64
        const ext = matches ? `.${matches[1].replace('jpeg', 'jpg')}` : '.jpg'
        const filename = `vendor-${vendor._id}-${Date.now()}${ext}`
        const uploadDir = path.join(__dirname, '../../uploads/vendors')
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
        const targetPath = path.join(uploadDir, filename)
        fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'))
        vendor.profileImage = `/uploads/vendors/${filename}`
      } catch (err) {
        console.error('Failed to save base64 avatar:', err)
      }
    } else if (req.body.profileImage !== undefined) {
      vendor.profileImage = req.body.profileImage
    }

    await vendor.save()

    // If vendor name was updated, update in quotations for consistency
    if (name && name.trim() && name.trim() !== oldName) {
      await Quotation.updateMany({ vendorId: vendor._id }, { vendorName: name.trim() }).catch(() => null)
    }

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone || '',
        address: vendor.address || '',
        profileImage: vendor.profileImage || '',
        status: vendor.status || 'Active'
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Vendor Realtime Dashboard Summary & Active Demands
 * @route   GET /api/vendors/dashboard
 * @access  Private (Vendor)
 */
export const getVendorDashboard = async (req, res) => {
  try {
    const vendorId = req.vendor._id

    // 1. Fetch currently active demands
    const activeDemands = await Demand.find({ status: 'Active' }).sort({ createdAt: -1 })

    // 2. Fetch all quotations submitted by this vendor
    const vendorQuotes = await Quotation.find({ vendorId }).sort({ submittedAt: -1 }).lean()

    // Create a Set of demandIds this vendor has already quoted
    const quotedDemandIds = new Set(vendorQuotes.map(q => q.demandId.toString()))

    // Format active demands with status flag whether vendor has already submitted quote
    const formattedDemands = activeDemands.map(d => ({
      _id: d._id,
      demandCode: d.demandCode,
      itemCount: d.items ? d.items.length : 0,
      publishedAt: d.publishedAt,
      deadlineAt: d.deadlineAt,
      durationHours: d.durationHours,
      hasSubmittedQuote: quotedDemandIds.has(d._id.toString()),
      items: d.items
    }))

    // Enhance vendor quotes with demand status and whether order was placed for this vendor
    const enhancedQuotes = await Promise.all(vendorQuotes.map(async (q) => {
      const d = await Demand.findById(q.demandId).select('status demandCode deadlineAt publishedAt items').lean()
      const ord = await Order.findOne({ demandId: q.demandId, vendorId }).lean()
      return {
        ...q,
        demandStatus: d ? d.status : 'Active',
        isAllocated: d ? (d.status === 'Allocated' || d.status === 'Completed') : false,
        order: ord || null,
        hasOrder: !!ord
      }
    }))

    // Completed quotes count: submitted quotations
    const completedCount = vendorQuotes.length

    res.json({
      success: true,
      vendor: {
        _id: req.vendor._id,
        name: req.vendor.name,
        email: req.vendor.email,
        phone: req.vendor.phone,
        address: req.vendor.address,
        profileImage: req.vendor.profileImage
      },
      metrics: {
        activeDemandsCount: activeDemands.length,
        completedCount: completedCount
      },
      activeDemands: formattedDemands,
      completedQuotations: enhancedQuotes
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Demand details for quotation submission
 * @route   GET /api/vendors/demands/:id
 * @access  Private (Vendor)
 */
export const getVendorDemandDetails = async (req, res) => {
  try {
    const demand = await Demand.findById(req.params.id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    // Check if vendor already submitted a quote for this demand
    const existingQuote = await Quotation.findOne({
      demandId: demand._id,
      vendorId: req.vendor._id
    })

    // Check if an order has been placed for this vendor for this demand
    const order = await Order.findOne({
      demandId: demand._id,
      vendorId: req.vendor._id
    })

    res.json({
      success: true,
      demand,
      hasSubmittedQuote: !!existingQuote,
      existingQuote: existingQuote || null,
      order: order || null,
      isAllocated: demand.status === 'Allocated' || demand.status === 'Completed',
      hasOrder: !!order
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Final Result & Order Placement for a Demand
 * @route   GET /api/vendors/demands/:id/final-result
 * @access  Private (Vendor)
 */
export const getVendorFinalResult = async (req, res) => {
  try {
    const demand = await Demand.findById(req.params.id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    const order = await Order.findOne({
      demandId: demand._id,
      vendorId: req.vendor._id
    })

    const quotation = await Quotation.findOne({
      demandId: demand._id,
      vendorId: req.vendor._id
    })

    res.json({
      success: true,
      demand,
      order: order || null,
      quotation: quotation || null,
      isAllocated: demand.status === 'Allocated' || demand.status === 'Completed',
      hasOrder: !!order
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Submit Quotation Rates from Vendor App
 * @route   POST /api/vendors/quotations
 * @access  Private (Vendor)
 */
export const submitVendorQuotation = async (req, res) => {
  try {
    const { demandId, quotedItems } = req.body

    if (!demandId || !quotedItems || !Array.isArray(quotedItems) || quotedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide demandId and quotedItems array' })
    }

    const demand = await Demand.findById(demandId)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    if (demand.status !== 'Active') {
      return res.status(400).json({ success: false, message: 'Bidding is closed for this demand' })
    }

    // Check deadline
    if (new Date() > new Date(demand.deadlineAt)) {
      return res.status(400).json({ success: false, message: 'Bidding deadline has expired' })
    }

    // Compute total quote amount
    const totalQuoteAmount = quotedItems.reduce((sum, item) => {
      const rate = Number(item.rate) || 0
      const qty = Number(item.quantity) || 0
      return sum + (rate * qty)
    }, 0)

    // Check if vendor already has a quotation for this demand (update or create)
    let quotation = await Quotation.findOne({ demandId: demand._id, vendorId: req.vendor._id })

    if (quotation) {
      // Update existing quotation
      quotation.quotedItems = quotedItems
      quotation.totalQuoteAmount = totalQuoteAmount
      quotation.submittedAt = new Date()
      await quotation.save()
    } else {
      // Create new quotation
      quotation = await Quotation.create({
        demandId: demand._id,
        demandCode: demand.demandCode,
        vendorId: req.vendor._id,
        vendorEmail: req.vendor.email,
        vendorName: req.vendor.name,
        quotedItems,
        totalQuoteAmount,
        submittedAt: new Date()
      })
    }

    res.json({
      success: true,
      message: 'Quotation rates successfully submitted!',
      quotation
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

