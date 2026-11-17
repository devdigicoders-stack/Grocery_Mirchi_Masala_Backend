import Quotation from '../models/Quotation.js'
import Demand from '../models/Demand.js'
import Vendor from '../models/Vendor.js'

/**
 * @desc    Get all quotations
 * @route   GET /api/quotations
 * @access  Private (Admin)
 */
export const getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find()
      .populate('demandId', 'demandCode status publishedAt deadlineAt')
      .populate('vendorId', 'name email phone status')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      count: quotations.length,
      data: quotations
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get quotations for a specific demand
 * @route   GET /api/quotations/demand/:demandId
 * @access  Private (Admin/Vendor)
 */
export const getQuotationsByDemand = async (req, res) => {
  try {
    const { demandId } = req.params
    const quotations = await Quotation.find({ demandId }).sort({ totalQuoteAmount: 1 })

    res.json({
      success: true,
      count: quotations.length,
      data: quotations
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get full side-by-side comparison matrix for a demand (with L1, L2, L3 ranks & savings)
 * @route   GET /api/quotations/compare/:demandId
 * @access  Private (Admin)
 */
export const getComparisonMatrix = async (req, res) => {
  try {
    const { demandId } = req.params

    const demand = await Demand.findById(demandId)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    const quotations = await Quotation.find({ demandId }).sort({ createdAt: 1 })

    // If no quotes submitted yet
    if (quotations.length === 0) {
      return res.json({
        success: true,
        demand: {
          _id: demand._id,
          demandCode: demand.demandCode,
          status: demand.status,
          publishedAt: demand.publishedAt,
          deadlineAt: demand.deadlineAt,
          itemsCount: demand.items?.length || 0
        },
        vendors: [],
        items: (demand.items || []).map((it, idx) => ({
          id: it._id || `item-${idx}`,
          name: it.name,
          unit: it.unit,
          qty: `${it.quantity} ${it.unit}`,
          quantity: it.quantity,
          rates: {},
          lowestRate: null,
          lowestVendor: null
        })),
        vendorSummary: [],
        totalSavings: 0,
        savingsPercent: 0
      })
    }

    // List of vendors who submitted
    const vendors = quotations.map((q) => ({
      id: q.vendorId ? q.vendorId.toString() : q._id.toString(),
      name: q.vendorName,
      email: q.vendorEmail,
      quoteId: q._id,
      totalQuote: q.totalQuoteAmount,
      submittedAt: q.submittedAt
    }))

    // Vendor stats tracking
    const vendorStats = {}
    vendors.forEach((v) => {
      vendorStats[v.id] = {
        id: v.id,
        name: v.name,
        email: v.email,
        totalQuote: v.totalQuote,
        bestItemsCount: 0, // L1 count
        secondBestCount: 0, // L2 count
        thirdBestCount: 0, // L3 count
        totalItemsQuoted: 0
      }
    })

    let totalL1Cost = 0
    let totalHighestCost = 0

    // Build item-wise comparison rows
    const items = (demand.items || []).map((demandItem, idx) => {
      const row = {
        id: demandItem._id || `item-${idx}`,
        name: demandItem.name,
        unit: demandItem.unit,
        qty: `${demandItem.quantity} ${demandItem.unit}`,
        quantity: demandItem.quantity,
        rates: {}, // vendorId -> { rate, formatted, rank }
        lowestRate: null,
        lowestVendor: null,
        lowestVendorId: null,
        highestRate: null
      }

      // Collect all quoted rates for this item
      const itemQuotes = []

      quotations.forEach((q) => {
        const vId = q.vendorId ? q.vendorId.toString() : q._id.toString()
        // Match quoted item by itemId or by trimmed lowercase name
        const match = (q.quotedItems || []).find(
          (qi) =>
            (demandItem.itemId && qi.itemId && qi.itemId.toString() === demandItem.itemId.toString()) ||
            (qi.name && demandItem.name && qi.name.trim().toLowerCase() === demandItem.name.trim().toLowerCase())
        )

        if (match && Number(match.rate) > 0) {
          const rate = Number(match.rate)
          itemQuotes.push({ vendorId: vId, vendorName: q.vendorName, rate })
          if (vendorStats[vId]) {
            vendorStats[vId].totalItemsQuoted++
          }
        }
      })

      if (itemQuotes.length > 0) {
        // Sort ascending by rate to determine L1, L2, L3
        itemQuotes.sort((a, b) => a.rate - b.rate)

        const lowest = itemQuotes[0]
        const highest = itemQuotes[itemQuotes.length - 1]

        row.lowestRate = lowest.rate
        row.lowestVendor = lowest.vendorName
        row.lowestVendorId = lowest.vendorId
        row.highestRate = highest.rate

        totalL1Cost += lowest.rate * Number(demandItem.quantity)
        totalHighestCost += highest.rate * Number(demandItem.quantity)

        // Assign ranks to each vendor's rate
        itemQuotes.forEach((iq, rankIdx) => {
          const rank = rankIdx + 1 // 1 = L1, 2 = L2, 3 = L3
          row.rates[iq.vendorId] = {
            rate: iq.rate,
            formatted: `₹${iq.rate.toFixed(2)}`,
            rank
          }

          if (vendorStats[iq.vendorId]) {
            if (rank === 1) vendorStats[iq.vendorId].bestItemsCount++
            else if (rank === 2) vendorStats[iq.vendorId].secondBestCount++
            else if (rank === 3) vendorStats[iq.vendorId].thirdBestCount++
          }
        })
      }

      return row
    })

    const totalSavings = Math.max(0, totalHighestCost - totalL1Cost)
    const savingsPercent = totalHighestCost > 0 ? ((totalSavings / totalHighestCost) * 100).toFixed(1) : 0

    const vendorSummary = Object.values(vendorStats)

    res.json({
      success: true,
      demand: {
        _id: demand._id,
        demandCode: demand.demandCode,
        status: demand.status,
        publishedAt: demand.publishedAt,
        deadlineAt: demand.deadlineAt,
        itemsCount: demand.items?.length || 0
      },
      vendors,
      items,
      vendorSummary,
      totalSavings,
      savingsPercent: Number(savingsPercent),
      totalL1Cost,
      totalHighestCost
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Submit or update quotation by vendor / admin on behalf of vendor
 * @route   POST /api/quotations/submit
 * @access  Private (Admin / Vendor)
 */
export const submitQuotation = async (req, res) => {
  try {
    const { demandId, vendorId, quotedItems } = req.body

    if (!demandId || !vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Demand ID and Vendor ID are required'
      })
    }

    if (!quotedItems || !Array.isArray(quotedItems) || quotedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one quoted item with a rate'
      })
    }

    const demand = await Demand.findById(demandId)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    const vendor = await Vendor.findById(vendorId)
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' })
    }

    // Filter valid quoted items
    const validQuotedItems = quotedItems
      .filter((it) => it.name && Number(it.rate) > 0)
      .map((it) => ({
        itemId: it.itemId || null,
        name: it.name.trim(),
        unit: it.unit || 'KG',
        quantity: Number(it.quantity) || 1,
        rate: Number(it.rate)
      }))

    if (validQuotedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item must have a positive quoted rate'
      })
    }

    // Calculate total quote amount
    const totalQuoteAmount = validQuotedItems.reduce(
      (sum, it) => sum + it.rate * it.quantity,
      0
    )

    // Check if quotation already exists for this vendor and demand
    let quotation = await Quotation.findOne({ demandId, vendorId })

    if (quotation) {
      quotation.quotedItems = validQuotedItems
      quotation.totalQuoteAmount = totalQuoteAmount
      quotation.submittedAt = new Date()
      quotation.vendorName = vendor.name
      quotation.vendorEmail = vendor.email
      quotation.demandCode = demand.demandCode
      await quotation.save()
    } else {
      quotation = await Quotation.create({
        demandId,
        demandCode: demand.demandCode,
        vendorId,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        quotedItems: validQuotedItems,
        totalQuoteAmount,
        submittedAt: new Date()
      })
    }

    res.status(201).json({
      success: true,
      message: `Quotation of ₹${totalQuoteAmount.toLocaleString('en-IN')} submitted successfully for ${vendor.name}`,
      data: quotation
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Delete a quotation
 * @route   DELETE /api/quotations/:id
 * @access  Private (Admin)
 */
export const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' })
    }

    await Quotation.findByIdAndDelete(req.params.id)
    res.json({
      success: true,
      message: 'Quotation deleted successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
