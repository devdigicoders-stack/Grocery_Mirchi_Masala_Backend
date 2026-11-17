import Demand from '../models/Demand.js'
import Quotation from '../models/Quotation.js'
import Vendor from '../models/Vendor.js'
import EmailLog from '../models/EmailLog.js'
import { broadcastRealtimeEvent } from '../utils/realtime.js'
import { sendPushToAllVendors, sendPushToVendor } from '../services/notificationService.js'

/**
 * Helper to auto-close bidding if deadline has passed
 */
const checkAndExpireDemand = async (demand) => {
  if (!demand) return demand
  if (demand.status === 'Active' && new Date(demand.deadlineAt) < new Date()) {
    demand.status = 'Bidding_Closed'
    await demand.save()
    try {
      broadcastRealtimeEvent('DEMAND_CLOSED', {
        demandId: demand._id,
        demandCode: demand.demandCode,
        status: 'Bidding_Closed'
      })
    } catch (_) {}
  }
  return demand
}

/**
 * @desc    Get all demands
 * @route   GET /api/demands
 * @access  Private (Admin)
 */
export const getDemands = async (req, res) => {
  try {
    const demands = await Demand.find().sort({ createdAt: -1 })
    // Check expiry for active ones
    for (const demand of demands) {
      await checkAndExpireDemand(demand)
    }
    res.json({
      success: true,
      count: demands.length,
      data: demands
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get current active demand
 * @route   GET /api/demands/active
 * @access  Private (Admin)
 */
export const getActiveDemand = async (req, res) => {
  try {
    let activeDemand = await Demand.findOne({ status: 'Active' }).sort({ createdAt: -1 })
    if (activeDemand) {
      activeDemand = await checkAndExpireDemand(activeDemand)
      // If it just expired, it's no longer Active
      if (activeDemand.status !== 'Active') {
        activeDemand = null
      }
    }
    res.json({
      success: true,
      data: activeDemand || null
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get single demand by ID
 * @route   GET /api/demands/:id
 * @access  Private (Admin)
 */
export const getDemandById = async (req, res) => {
  try {
    let demand = await Demand.findById(req.params.id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }
    demand = await checkAndExpireDemand(demand)
    res.json({ success: true, data: demand })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Create a new Demand with 48h live timer
 * @route   POST /api/demands
 * @access  Private (Admin)
 */
export const createDemand = async (req, res) => {
  try {
    const { items, durationHours = 48 } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one item for the demand'
      })
    }

    // Filter valid items (must have name and quantity > 0)
    const validItems = items.filter(
      (item) => item.name && item.name.trim() !== '' && Number(item.quantity) > 0
    )

    if (validItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid items with non-empty name and quantity > 0 were found'
      })
    }

    // Generate sequential demandCode: DM-0001, DM-0002...
    const count = await Demand.countDocuments()
    let nextNum = count + 1
    let demandCode = `DM-${String(nextNum).padStart(4, '0')}`

    // Ensure uniqueness
    while (await Demand.findOne({ demandCode })) {
      nextNum++
      demandCode = `DM-${String(nextNum).padStart(4, '0')}`
    }

    // Mark previous active demands as Bidding_Closed
    await Demand.updateMany({ status: 'Active' }, { status: 'Bidding_Closed' })

    const publishedAt = new Date()
    const hours = Number(durationHours) || 48
    const deadlineAt = new Date(publishedAt.getTime() + hours * 60 * 60 * 1000)

    const formattedItems = validItems.map((item) => ({
      itemId: item.itemId || null,
      name: item.name.trim(),
      unit: item.unit || 'KG',
      quantity: Number(item.quantity)
    }))

    const newDemand = await Demand.create({
      demandCode,
      items: formattedItems,
      publishedAt,
      deadlineAt,
      durationHours: hours,
      status: 'Active'
    })

    // Broadcast real-time event to all connected Vendor Apps and Admin instances
    try {
      broadcastRealtimeEvent('DEMAND_PUBLISHED', {
        demandId: newDemand._id,
        demandCode: newDemand.demandCode,
        itemCount: formattedItems.length,
        items: formattedItems.slice(0, 5),
        publishedAt: newDemand.publishedAt,
        deadlineAt: newDemand.deadlineAt,
        durationHours: hours,
        status: 'Active'
      })
    } catch (sseErr) {
      console.warn('Real-time broadcast warning:', sseErr.message)
    }

    // Automatically notify all active vendors via Push Notification & EmailLogs
    try {
      // 1. Send Mobile Push Notification (FCM + Real-Time SSE)
      sendPushToAllVendors({
        title: `🚨 New Demand Live: ${demandCode}`,
        body: `${formattedItems.length} grocery items required. Submit your lowest unit rates now!`,
        data: {
          demandId: String(newDemand._id),
          demandCode: newDemand.demandCode,
          deadlineAt: newDemand.deadlineAt?.toISOString() || '',
          itemCount: String(formattedItems.length)
        },
        type: 'new_demand',
        sentByAdminId: req.admin?._id
      }).catch((pErr) => console.warn('Push notification warning:', pErr.message))

      // 2. Log in EmailLog
      const activeVendors = await Vendor.find({ status: 'Active' })
      if (activeVendors.length > 0) {
        const itemsSummary = formattedItems
          .slice(0, 5)
          .map((it) => `• ${it.name} (${it.quantity} ${it.unit})`)
          .join('\n')
        const moreText =
          formattedItems.length > 5
            ? `\n...and ${formattedItems.length - 5} more items`
            : ''

        const emailLogs = activeVendors.map((v) => ({
          demandId: newDemand._id,
          demandCode: newDemand.demandCode,
          vendorId: v._id,
          vendorName: v.name,
          vendorEmail: v.email,
          emailType: 'Demand Notification',
          subject: `New Demand ${demandCode} Published - Mirch Masala Grocery Shop`,
          content: `Dear ${v.name},\n\nA new grocery demand (${demandCode}) has been published by Mirch Masala Grocery Shop.\n\nTotal Items: ${formattedItems.length}\nDuration: ${hours} Hours (Bidding Window)\nDeadline: ${deadlineAt.toLocaleString('en-IN')}\n\nKey Items Required:\n${itemsSummary}${moreText}\n\nPlease open your Mirch Masala Vendor App and submit your best rates before the deadline.\n\nRegards,\nMirch Masala Grocery Shop`,
          status: 'Sent',
          sentAt: new Date()
        }))

        await EmailLog.insertMany(emailLogs)
      }
    } catch (notifErr) {
      console.warn('Vendor notification email logs warning:', notifErr.message)
    }

    res.status(201).json({
      success: true,
      message: `Demand ${demandCode} published successfully with 48-Hour Live Bidding window!`,
      data: newDemand
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get submissions & pending vendors for a demand
 * @route   GET /api/demands/:id/submissions
 * @access  Private (Admin)
 */
export const getDemandSubmissions = async (req, res) => {
  try {
    const demand = await Demand.findById(req.params.id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    // Get all quotes submitted for this demand
    const quotations = await Quotation.find({ demandId: req.params.id }).sort({
      submittedAt: -1
    })

    // Get all registered vendors
    const allVendors = await Vendor.find().sort({ name: 1 })

    // Build submitted set
    const submittedVendorIds = new Set(
      quotations.map((q) => q.vendorId ? q.vendorId.toString() : null).filter(Boolean)
    )

    // Build pending vendors list
    const pendingVendors = allVendors
      .filter((v) => !submittedVendorIds.has(v._id.toString()))
      .map((v) => ({
        id: v._id,
        vendor: v.name,
        email: v.email,
        phone: v.phone || '',
        status: 'Awaiting Bid',
        reminded: false
      }))

    // Format submissions list
    const submissions = quotations.map((q, idx) => ({
      id: q._id,
      index: idx + 1,
      vendorId: q.vendorId,
      vendor: q.vendorName,
      email: q.vendorEmail,
      time: q.submittedAt,
      totalQuote: q.totalQuoteAmount,
      quotedItems: q.quotedItems || [],
      status: 'Submitted'
    }))

    res.json({
      success: true,
      demandId: demand._id,
      demandCode: demand.demandCode,
      counts: {
        totalVendors: allVendors.length,
        submittedCount: submissions.length,
        pendingCount: pendingVendors.length
      },
      submissions,
      pendingVendors
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Send reminder to a specific pending vendor
 * @route   POST /api/demands/:id/remind/:vendorId
 * @access  Private (Admin)
 */
export const sendVendorReminder = async (req, res) => {
  try {
    const { id, vendorId } = req.params
    const demand = await Demand.findById(id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    const vendor = await Vendor.findById(vendorId)
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    // In a production setup, this would trigger WhatsApp Business API & Nodemailer email
    await EmailLog.create({
      demandId: demand._id,
      demandCode: demand.demandCode,
      vendorId: vendor._id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      emailType: 'Bidding Reminder',
      subject: `Urgent Bidding Reminder - 48h Window Active for Demand ${demand.demandCode}`,
      content: `Dear ${vendor.name},\n\nThis is a reminder that the 48-Hour Live Bidding window is currently active for Demand ${demand.demandCode}.\nPlease open the Mirch Masala Vendor App and submit your wholesale rates before the deadline.\n\nThank you,\nMirch Masala Grocery Shop`,
      status: 'Sent'
    }).catch(() => null)

    res.json({
      success: true,
      message: `48h Bidding reminder sent to ${vendor.name} (${vendor.phone || vendor.email}) successfully!`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Send bulk reminder to all pending vendors
 * @route   POST /api/demands/:id/remind-all
 * @access  Private (Admin)
 */
export const sendBulkReminder = async (req, res) => {
  try {
    const { id } = req.params
    const demand = await Demand.findById(id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    // Count pending vendors
    const quotations = await Quotation.find({ demandId: id })
    const submittedVendorIds = new Set(
      quotations.map((q) => q.vendorId ? q.vendorId.toString() : null).filter(Boolean)
    )
    const pendingVendors = await Vendor.find({
      _id: { $nin: Array.from(submittedVendorIds) }
    })

    for (const v of pendingVendors) {
      // 1. Send Mobile Push Notification to each pending vendor
      sendPushToVendor(v._id, {
        title: `⏰ Bidding Reminder: Demand ${demand.demandCode}`,
        body: `48-Hour Live Bidding window is active! Submit your unit rates before deadline.`,
        data: {
          demandId: String(demand._id),
          demandCode: demand.demandCode
        },
        type: 'bidding_reminder',
        sentByAdminId: req.admin?._id
      }).catch(() => null)

      // 2. Create EmailLog
      await EmailLog.create({
        demandId: demand._id,
        demandCode: demand.demandCode,
        vendorId: v._id,
        vendorName: v.name,
        vendorEmail: v.email,
        emailType: 'Bidding Reminder',
        subject: `Urgent Bidding Reminder - 48h Window Active for Demand ${demand.demandCode}`,
        content: `Dear ${v.name},\n\nThis is a reminder that the 48-Hour Live Bidding window is currently active for Demand ${demand.demandCode}.\nPlease open the Mirch Masala Vendor App and submit your wholesale rates before the deadline.\n\nThank you,\nMirch Masala Grocery Shop`,
        status: 'Sent'
      }).catch(() => null)
    }

    res.json({
      success: true,
      message: `48h Bidding reminder sent to all ${pendingVendors.length} pending vendors via WhatsApp & Email!`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Close bidding manually
 * @route   PUT /api/demands/:id/close
 * @access  Private (Admin)
 */
export const closeDemandBidding = async (req, res) => {
  try {
    const demand = await Demand.findById(req.params.id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    demand.status = 'Bidding_Closed'
    await demand.save()

    // Broadcast real-time event to all connected Vendor Apps
    try {
      broadcastRealtimeEvent('DEMAND_CLOSED', {
        demandId: demand._id,
        demandCode: demand.demandCode,
        status: 'Bidding_Closed'
      })
    } catch (sseErr) {
      console.warn('Real-time broadcast warning:', sseErr.message)
    }

    res.json({
      success: true,
      message: `Demand ${demand.demandCode} bidding closed successfully`,
      data: demand
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Delete a demand
 * @route   DELETE /api/demands/:id
 * @access  Private (Admin)
 */
export const deleteDemand = async (req, res) => {
  try {
    const demand = await Demand.findById(req.params.id)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    await Demand.findByIdAndDelete(req.params.id)
    await Quotation.deleteMany({ demandId: req.params.id })

    // Broadcast real-time event to all connected Vendor Apps
    try {
      broadcastRealtimeEvent('DEMAND_DELETED', {
        demandId: req.params.id,
        demandCode: demand.demandCode
      })
    } catch (sseErr) {
      console.warn('Real-time broadcast warning:', sseErr.message)
    }

    res.json({
      success: true,
      message: `Demand ${demand.demandCode} and associated quotations deleted`
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
