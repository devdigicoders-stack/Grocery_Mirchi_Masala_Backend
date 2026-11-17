import Demand from '../models/Demand.js'
import Quotation from '../models/Quotation.js'
import Order from '../models/Order.js'
import Vendor from '../models/Vendor.js'
import Item from '../models/Item.js'

/**
 * Helper to build date query filter based on range parameter
 */
const getDateFilter = (range) => {
  const now = new Date()
  let start = null
  if (range === 'today') {
    start = new Date()
    start.setHours(0, 0, 0, 0)
  } else if (range === 'this_week') {
    start = new Date()
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
  } else if (range === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (range === 'last_30_days') {
    start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  } else if (range === 'last_90_days') {
    start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  } else if (range === 'this_year') {
    start = new Date(now.getFullYear(), 0, 1)
  }
  if (!start) return {}
  return {
    $or: [
      { createdAt: { $gte: start } },
      { publishedAt: { $gte: start } },
      { submittedAt: { $gte: start } }
    ]
  }
}

/**
 * @desc    Get Demand Summary Report
 * @route   GET /api/reports/demand-summary
 * @access  Private (Admin)
 */
export const getDemandSummaryReport = async (req, res) => {
  try {
    const { range = 'all' } = req.query
    const dateQuery = getDateFilter(range)

    const demands = await Demand.find(dateQuery).sort({ createdAt: -1 })
    const demandIds = demands.map((d) => d._id)
    const demandIdStrs = demandIds.map((id) => id.toString())

    const [quotations, orders] = await Promise.all([
      Quotation.find({
        $or: [
          { demandId: { $in: demandIds } },
          { demandId: { $in: demandIdStrs } }
        ]
      }).lean(),
      Order.find({
        $or: [
          { demandId: { $in: demandIds } },
          { demandId: { $in: demandIdStrs } }
        ]
      }).lean()
    ])

    // Map quotes and orders by demandId
    const quotesCountByDemand = {}
    quotations.forEach((q) => {
      const dId = q.demandId?.toString()
      if (dId) {
        quotesCountByDemand[dId] = (quotesCountByDemand[dId] || 0) + 1
      }
    })

    const ordersTotalByDemand = {}
    orders.forEach((o) => {
      const dId = o.demandId?.toString()
      if (dId) {
        ordersTotalByDemand[dId] = (ordersTotalByDemand[dId] || 0) + (Number(o.totalOrderAmount) || 0)
      }
    })

    let totalSpend = 0
    let totalItemsDemanded = 0
    let activeDemandsCount = 0

    const demandRows = demands.map((d) => {
      const dId = d._id.toString()
      const itemsCount = d.items?.length || 0
      const totalQty = (d.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
      const allocatedValue = ordersTotalByDemand[dId] || 0
      const bidsCount = quotesCountByDemand[dId] || 0

      totalSpend += allocatedValue
      totalItemsDemanded += itemsCount
      if (d.status === 'Active') activeDemandsCount++

      return {
        id: d._id,
        demandCode: d.demandCode,
        publishedAt: d.publishedAt,
        deadlineAt: d.deadlineAt,
        status: d.status,
        itemsCount,
        totalQuantity: totalQty,
        bidsCount,
        allocatedValue
      }
    })

    res.json({
      success: true,
      range,
      kpis: {
        totalDemands: demands.length,
        activeDemands: activeDemandsCount,
        totalSpend,
        totalItemsDemanded
      },
      demands: demandRows
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Vendor Performance Report
 * @route   GET /api/reports/vendor-performance
 * @access  Private (Admin)
 */
export const getVendorPerformanceReport = async (req, res) => {
  try {
    const { range = 'all' } = req.query
    const dateQuery = getDateFilter(range)

    const [vendors, quotations, orders] = await Promise.all([
      Vendor.find().sort({ name: 1 }),
      Quotation.find(dateQuery),
      Order.find(dateQuery)
    ])

    // Group quotations by vendorId and vendorEmail for robustness
    const quotesByVendor = {}
    const quotesByEmail = {}
    quotations.forEach((q) => {
      const vId = q.vendorId?.toString()
      const email = q.vendorEmail?.toLowerCase().trim()
      if (vId) {
        if (!quotesByVendor[vId]) quotesByVendor[vId] = []
        quotesByVendor[vId].push(q)
      }
      if (email) {
        if (!quotesByEmail[email]) quotesByEmail[email] = []
        quotesByEmail[email].push(q)
      }
    })

    // Group orders by vendorId and vendorEmail
    const ordersByVendor = {}
    const ordersByEmail = {}
    orders.forEach((o) => {
      const vId = o.vendorId?.toString()
      const email = o.vendorEmail?.toLowerCase().trim()
      if (vId) {
        if (!ordersByVendor[vId]) ordersByVendor[vId] = []
        ordersByVendor[vId].push(o)
      }
      if (email) {
        if (!ordersByEmail[email]) ordersByEmail[email] = []
        ordersByEmail[email].push(o)
      }
    })

    let totalAllocatedSpend = 0
    let participatingCount = 0

    const vendorRows = vendors.map((v) => {
      const vId = v._id.toString()
      const vEmail = v.email?.toLowerCase().trim()
      const vQuotes = quotesByVendor[vId] || (vEmail ? quotesByEmail[vEmail] : null) || []
      const vOrders = ordersByVendor[vId] || (vEmail ? ordersByEmail[vEmail] : null) || []

      const totalQuotedItems = vQuotes.reduce((acc, q) => acc + (q.quotedItems?.length || 0), 0)
      const wonItemsCount = vOrders.reduce((acc, o) => acc + (o.items?.length || 0), 0)
      const totalRevenue = vOrders.reduce((acc, o) => acc + (Number(o.totalOrderAmount) || 0), 0)

      const winRate = totalQuotedItems > 0 ? ((wonItemsCount / totalQuotedItems) * 100).toFixed(1) : 0

      if (vQuotes.length > 0 || vOrders.length > 0) {
        participatingCount++
      }
      totalAllocatedSpend += totalRevenue

      return {
        id: v._id,
        name: v.name,
        email: v.email,
        phone: v.phone || '',
        status: v.status,
        demandsQuotedCount: vQuotes.length,
        itemsQuotedCount: totalQuotedItems,
        itemsWonCount: wonItemsCount,
        winRate: Number(winRate),
        totalRevenue
      }
    })

    // Sort by revenue descending, then by demands quoted
    vendorRows.sort((a, b) => b.totalRevenue - a.totalRevenue || b.demandsQuotedCount - a.demandsQuotedCount)

    const topVendor = vendorRows.find((v) => v.totalRevenue > 0) || null

    res.json({
      success: true,
      range,
      kpis: {
        totalVendors: vendors.length,
        activeVendors: vendors.filter((v) => v.status === 'Active').length,
        participatingVendors: participatingCount,
        totalAllocatedSpend,
        topVendor: topVendor ? { name: topVendor.name, revenue: topVendor.totalRevenue } : null
      },
      vendors: vendorRows
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Item-wise Rate Analytics Report
 * @route   GET /api/reports/item-rates
 * @access  Private (Admin)
 */
export const getItemWiseRateReport = async (req, res) => {
  try {
    const { range = 'all' } = req.query
    const dateQuery = getDateFilter(range)

    const [demands, quotations, orders, masterItems] = await Promise.all([
      Demand.find(dateQuery),
      Quotation.find(dateQuery),
      Order.find(dateQuery),
      Item.find().lean()
    ])

    // Aggregate by item name
    const itemMap = {}

    // Seed master items so category and units are standard
    masterItems.forEach((it) => {
      const key = it.name?.trim().toLowerCase()
      if (key && !itemMap[key]) {
        itemMap[key] = {
          name: it.name.trim(),
          unit: it.unit || 'KG',
          category: it.category || 'General',
          timesDemanded: 0,
          totalQuantityDemanded: 0,
          quotedRates: [],
          wonRates: [],
          totalSpend: 0
        }
      }
    })

    // 1. Process items from Demands
    demands.forEach((d) => {
      ;(d.items || []).forEach((it) => {
        const key = it.name?.trim().toLowerCase()
        if (!key) return
        if (!itemMap[key]) {
          itemMap[key] = {
            name: it.name.trim(),
            unit: it.unit || 'KG',
            category: 'General',
            timesDemanded: 0,
            totalQuantityDemanded: 0,
            quotedRates: [],
            wonRates: [],
            totalSpend: 0
          }
        }
        itemMap[key].timesDemanded++
        itemMap[key].totalQuantityDemanded += Number(it.quantity) || 0
      })
    })

    // 2. Process quoted rates
    quotations.forEach((q) => {
      ;(q.quotedItems || []).forEach((qi) => {
        const key = qi.name?.trim().toLowerCase()
        if (!key) return
        if (!itemMap[key]) {
          itemMap[key] = {
            name: qi.name.trim(),
            unit: qi.unit || 'KG',
            category: 'General',
            timesDemanded: 0,
            totalQuantityDemanded: Number(qi.quantity) || 0,
            quotedRates: [],
            wonRates: [],
            totalSpend: 0
          }
        }
        if (Number(qi.rate) > 0) {
          itemMap[key].quotedRates.push(Number(qi.rate))
        }
      })
    })

    // 3. Process won orders
    orders.forEach((o) => {
      ;(o.items || []).forEach((oi) => {
        const key = oi.name?.trim().toLowerCase()
        if (!key) return
        if (!itemMap[key]) {
          itemMap[key] = {
            name: oi.name.trim(),
            unit: oi.unit || 'KG',
            category: 'General',
            timesDemanded: 0,
            totalQuantityDemanded: Number(oi.quantity) || 0,
            quotedRates: [],
            wonRates: [],
            totalSpend: 0
          }
        }
        if (Number(oi.allocatedRate) > 0) {
          itemMap[key].wonRates.push(Number(oi.allocatedRate))
        }
        itemMap[key].totalSpend += Number(oi.itemTotal) || 0
      })
    })

    let totalSpend = 0
    let totalQuantity = 0

    let itemRows = Object.values(itemMap).map((it) => {
      const minRate = it.quotedRates.length > 0 ? Math.min(...it.quotedRates) : (it.wonRates.length > 0 ? Math.min(...it.wonRates) : 0)
      const maxRate = it.quotedRates.length > 0 ? Math.max(...it.quotedRates) : (it.wonRates.length > 0 ? Math.max(...it.wonRates) : 0)
      const avgQuotedRate =
        it.quotedRates.length > 0
          ? (it.quotedRates.reduce((a, b) => a + b, 0) / it.quotedRates.length).toFixed(2)
          : 0
      const avgWinningRate =
        it.wonRates.length > 0
          ? (it.wonRates.reduce((a, b) => a + b, 0) / it.wonRates.length).toFixed(2)
          : minRate > 0
          ? minRate.toFixed(2)
          : 0

      totalSpend += it.totalSpend
      totalQuantity += it.totalQuantityDemanded

      return {
        name: it.name,
        unit: it.unit,
        category: it.category,
        timesDemanded: it.timesDemanded,
        totalQuantityDemanded: it.totalQuantityDemanded,
        minRate,
        maxRate,
        avgQuotedRate: Number(avgQuotedRate),
        avgWinningRate: Number(avgWinningRate),
        totalSpend: it.totalSpend
      }
    })

    // If specific date range is selected, show items with activity in that period
    if (range !== 'all') {
      itemRows = itemRows.filter((it) => it.timesDemanded > 0 || it.minRate > 0 || it.totalSpend > 0)
    }

    // Sort by times demanded descending, then by spend, then name
    itemRows.sort((a, b) => b.timesDemanded - a.timesDemanded || b.totalSpend - a.totalSpend || a.name.localeCompare(b.name))

    res.json({
      success: true,
      range,
      kpis: {
        uniqueItemsCount: itemRows.length,
        totalQuantity,
        totalSpend
      },
      items: itemRows
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Real-time Dashboard Overview Data
 * @route   GET /api/reports/dashboard-overview
 * @access  Private (Admin)
 */
export const getDashboardOverview = async (req, res) => {
  try {
    // 1. Fetch KPI counts concurrently from MongoDB
    const [
      totalVendors,
      activeVendors,
      activeDemands,
      completedDemands,
      totalDemands,
      totalItems,
      activeItems,
      totalOrders,
      ordersAgg
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.countDocuments({ status: 'Active' }),
      Demand.countDocuments({ status: 'Active' }),
      Demand.countDocuments({ status: { $in: ['Completed', 'Allocated'] } }),
      Demand.countDocuments(),
      Item.countDocuments(),
      Item.countDocuments({ status: 'Active' }),
      Order.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalSpend: { $sum: '$totalOrderAmount' }
          }
        }
      ])
    ])

    const totalSpend = ordersAgg.length > 0 ? ordersAgg[0].totalSpend : 0

    // 2. Fetch Demand Trend (Last 6 demands in chronological order)
    const recentDemands = await Demand.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .lean()

    // Reverse to chronological order (oldest to newest among last 6)
    const chronologicalDemands = [...recentDemands].reverse()
    const recentDemandIds = chronologicalDemands.map((d) => d._id)

    // Count quotes for each demand
    const quotationsForTrend = await Quotation.find({ demandId: { $in: recentDemandIds } }).lean()
    const quoteCountByDemand = {}
    quotationsForTrend.forEach((q) => {
      const dId = q.demandId?.toString()
      if (dId) quoteCountByDemand[dId] = (quoteCountByDemand[dId] || 0) + 1
    })

    const demandTrend = chronologicalDemands.map((d, index) => {
      const dId = d._id.toString()
      const itemsCount = d.items?.length || 0
      const totalQty = (d.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
      const bidsCount = quoteCountByDemand[dId] || 0

      return {
        id: d._id,
        demandCode: d.demandCode,
        label: d.demandCode || `D${index + 1}`,
        itemsCount,
        totalQuantity: totalQty,
        bidsCount,
        status: d.status,
        publishedAt: d.publishedAt,
        deadlineAt: d.deadlineAt
      }
    })

    // 3. Item Allocation for the latest allocated demand (or latest demand with orders)
    const latestOrder = await Order.findOne().sort({ createdAt: -1 }).lean()
    let allocationData = null

    if (latestOrder) {
      const targetDemandId = latestOrder.demandId
      const targetDemand = await Demand.findById(targetDemandId).lean()
      const demandOrders = await Order.find({ demandId: targetDemandId }).lean()

      const vendorAllocationMap = {}
      let totalAllocatedItems = 0
      let totalAllocatedSpend = 0

      demandOrders.forEach((o) => {
        const vName = o.vendorName || 'Vendor'
        const count = o.items?.length || 0
        const amount = Number(o.totalOrderAmount) || 0

        if (!vendorAllocationMap[vName]) {
          vendorAllocationMap[vName] = {
            vendorName: vName,
            vendorEmail: o.vendorEmail,
            itemsCount: 0,
            totalAmount: 0
          }
        }
        vendorAllocationMap[vName].itemsCount += count
        vendorAllocationMap[vName].totalAmount += amount
        totalAllocatedItems += count
        totalAllocatedSpend += amount
      })

      const slices = Object.values(vendorAllocationMap).map((v) => ({
        ...v,
        percentage: totalAllocatedItems > 0 ? Math.round((v.itemsCount / totalAllocatedItems) * 100) : 0
      }))

      allocationData = {
        demandCode: targetDemand?.demandCode || latestOrder.demandCode,
        demandId: targetDemandId,
        totalItems: totalAllocatedItems,
        totalSpend: totalAllocatedSpend,
        allocations: slices
      }
    }

    // 4. Recent Active Demands (up to 4)
    const activeDemandsList = await Demand.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean()

    const activeListWithBids = await Promise.all(
      activeDemandsList.map(async (d) => {
        const bidsCount = await Quotation.countDocuments({ demandId: d._id })
        return {
          _id: d._id,
          demandCode: d.demandCode,
          itemsCount: d.items?.length || 0,
          publishedAt: d.publishedAt,
          deadlineAt: d.deadlineAt,
          durationHours: d.durationHours || 48,
          status: d.status,
          bidsCount
        }
      })
    )

    // 5. Recent Quotations (up to 4)
    const recentQuotationsList = await Quotation.find()
      .sort({ createdAt: -1 })
      .limit(4)
      .lean()

    const recentQuotations = recentQuotationsList.map((q) => ({
      _id: q._id,
      demandCode: q.demandCode,
      vendorName: q.vendorName,
      vendorEmail: q.vendorEmail,
      itemsCount: q.quotedItems?.length || 0,
      createdAt: q.createdAt
    }))

    // 6. Recent Purchase Orders (up to 4)
    const recentOrdersList = await Order.find()
      .sort({ createdAt: -1 })
      .limit(4)
      .lean()

    const recentOrders = recentOrdersList.map((o) => ({
      _id: o._id,
      demandCode: o.demandCode,
      vendorName: o.vendorName,
      itemsCount: o.items?.length || 0,
      totalOrderAmount: o.totalOrderAmount,
      status: o.status,
      createdAt: o.createdAt
    }))

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      kpis: {
        totalVendors,
        activeVendors,
        activeDemands,
        completedDemands,
        totalDemands,
        totalItems,
        activeItems,
        totalOrders,
        totalSpend
      },
      demandTrend,
      itemAllocation: allocationData,
      recentActiveDemands: activeListWithBids,
      recentQuotations,
      recentOrders
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
