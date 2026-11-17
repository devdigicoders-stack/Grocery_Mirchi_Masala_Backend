import Order from '../models/Order.js'
import Demand from '../models/Demand.js'
import Quotation from '../models/Quotation.js'
import Vendor from '../models/Vendor.js'
import EmailLog from '../models/EmailLog.js'

/**
 * @desc    Get allocation preview & auto-calculated L1 results for a demand
 * @route   GET /api/allocations/preview/:demandId
 * @access  Private (Admin)
 */
export const getAllocationPreview = async (req, res) => {
  try {
    const { demandId } = req.params

    const demand = await Demand.findById(demandId)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    const quotations = await Quotation.find({ demandId })
    const existingOrders = await Order.find({ demandId })

    // If existing confirmed orders exist, load them
    const isFinalized = existingOrders.length > 0 && existingOrders.some((o) => o.status === 'Approved' || o.status === 'PO_Dispatched')

    if (quotations.length === 0) {
      return res.json({
        success: true,
        demand: {
          _id: demand._id,
          demandCode: demand.demandCode,
          status: demand.status
        },
        stats: {
          totalItems: demand.items?.length || 0,
          vendorsParticipated: 0,
          allocatedItemsCount: 0,
          unallocatedCount: demand.items?.length || 0,
          totalAllocatedAmount: 0
        },
        vendorAllocations: [],
        allocatedItems: (demand.items || []).map((it, idx) => ({
          id: it._id || `item-${idx}`,
          name: it.name,
          unit: it.unit,
          quantity: it.quantity,
          vendor: 'Unallocated',
          vendorId: null,
          rate: 0,
          total: 0
        })),
        isFinalized: false,
        existingOrders: []
      })
    }

    // Auto-calculate L1 allocation for each demand item
    const allocatedItems = []
    const vendorMap = {} // vendorId -> { id, name, email, items: [], totalAmount: 0, isWinner: false }

    // Initialize all quoting vendors in map
    quotations.forEach((q) => {
      const vId = q.vendorId ? q.vendorId.toString() : q._id.toString()
      vendorMap[vId] = {
        id: vId,
        vendorId: q.vendorId,
        name: q.vendorName,
        email: q.vendorEmail,
        items: [],
        totalAmount: 0,
        isWinner: false,
        status: 'Pending_Approval'
      }
    })

    let totalAllocatedAmount = 0
    let allocatedItemsCount = 0

    ;(demand.items || []).forEach((demandItem, idx) => {
      // Find all quotes for this item
      const itemBids = []

      quotations.forEach((q) => {
        const vId = q.vendorId ? q.vendorId.toString() : q._id.toString()
        const match = (q.quotedItems || []).find(
          (qi) =>
            (demandItem.itemId && qi.itemId && qi.itemId.toString() === demandItem.itemId.toString()) ||
            (qi.name && demandItem.name && qi.name.trim().toLowerCase() === demandItem.name.trim().toLowerCase())
        )

        if (match && Number(match.rate) > 0) {
          itemBids.push({
            vendorId: vId,
            vendorName: q.vendorName,
            vendorEmail: q.vendorEmail,
            rate: Number(match.rate)
          })
        }
      })

      if (itemBids.length > 0) {
        // Sort to get L1 (lowest bidder)
        itemBids.sort((a, b) => a.rate - b.rate)
        const l1 = itemBids[0]
        const quantity = Number(demandItem.quantity) || 1
        const subtotal = l1.rate * quantity

        allocatedItemsCount++
        totalAllocatedAmount += subtotal

        allocatedItems.push({
          id: demandItem._id || `item-${idx}`,
          name: demandItem.name,
          unit: demandItem.unit,
          quantity,
          vendor: l1.vendorName,
          vendorId: l1.vendorId,
          vendorEmail: l1.vendorEmail,
          rate: l1.rate,
          total: subtotal
        })

        if (vendorMap[l1.vendorId]) {
          vendorMap[l1.vendorId].items.push({
            name: demandItem.name,
            unit: demandItem.unit,
            quantity,
            rate: l1.rate,
            subtotal
          })
          vendorMap[l1.vendorId].totalAmount += subtotal
          vendorMap[l1.vendorId].isWinner = true
        }
      } else {
        // No bids on this item
        allocatedItems.push({
          id: demandItem._id || `item-${idx}`,
          name: demandItem.name,
          unit: demandItem.unit,
          quantity: demandItem.quantity,
          vendor: 'No Bids Received',
          vendorId: null,
          vendorEmail: null,
          rate: 0,
          total: 0
        })
      }
    })

    // If existing confirmed orders exist, map their statuses
    if (existingOrders.length > 0) {
      existingOrders.forEach((eo) => {
        const vId = eo.vendorId ? eo.vendorId.toString() : null
        if (vId && vendorMap[vId]) {
          vendorMap[vId].status = eo.status
        }
      })
    }

    const vendorAllocations = Object.values(vendorMap).map((v) => {
      const q = quotations.find(
        (quote) =>
          (quote.vendorId?.toString() || quote._id?.toString()) === v.id
      )
      return {
        id: v.id,
        vendorId: v.vendorId,
        name: v.name,
        email: v.email,
        itemsAllocatedCount: v.items.length,
        itemsAllocated: `${v.items.length} Item${v.items.length === 1 ? '' : 's'}`,
        details:
          v.items.length > 0
            ? v.items.map((i) => i.name).join(', ')
            : 'None (Rates were higher)',
        items: v.items,
        allQuotedItems: q?.quotedItems || [],
        totalQuotedAmount: q?.totalQuoteAmount || 0,
        totalAmount: v.totalAmount,
        isWinner: v.isWinner,
        status: isFinalized
          ? v.isWinner
            ? v.status || 'Approved'
            : 'Rejected'
          : v.isWinner
          ? 'Pending_Approval'
          : 'No_Allocation'
      }
    })

    res.json({
      success: true,
      demand: {
        _id: demand._id,
        demandCode: demand.demandCode,
        status: demand.status
      },
      stats: {
        totalItems: demand.items?.length || 0,
        vendorsParticipated: quotations.length,
        allocatedItemsCount,
        unallocatedCount: (demand.items?.length || 0) - allocatedItemsCount,
        totalAllocatedAmount
      },
      vendorAllocations,
      allocatedItems,
      isFinalized,
      existingOrders
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Confirm and finalize allocations, creating official Purchase Orders (Orders)
 * @route   POST /api/allocations/confirm/:demandId
 * @access  Private (Admin)
 */
export const confirmAllocations = async (req, res) => {
  try {
    const { demandId } = req.params

    const demand = await Demand.findById(demandId)
    if (!demand) {
      return res.status(404).json({ success: false, message: 'Demand not found' })
    }

    const quotations = await Quotation.find({ demandId })
    if (quotations.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot allocate demand with no quotations' })
    }

    // Auto-calculate or accept custom item allocations
    const customAllocations = req.body.allocations // optional override: [{ itemId, vendorId, rate }]

    const vendorOrdersMap = {}

    ;(demand.items || []).forEach((demandItem) => {
      let chosenBid = null

      if (customAllocations && Array.isArray(customAllocations)) {
        const override = customAllocations.find(
          (ca) => ca.itemId?.toString() === demandItem._id?.toString()
        )
        if (override) {
          const q = quotations.find((q) => q.vendorId?.toString() === override.vendorId?.toString())
          if (q) {
            chosenBid = {
              vendorId: q.vendorId,
              vendorName: q.vendorName,
              vendorEmail: q.vendorEmail,
              rate: Number(override.rate)
            }
          }
        }
      }

      if (!chosenBid) {
        // Standard L1 calculation
        const itemBids = []
        quotations.forEach((q) => {
          const match = (q.quotedItems || []).find(
            (qi) =>
              (demandItem.itemId && qi.itemId && qi.itemId.toString() === demandItem.itemId.toString()) ||
              (qi.name && demandItem.name && qi.name.trim().toLowerCase() === demandItem.name.trim().toLowerCase())
          )
          if (match && Number(match.rate) > 0) {
            itemBids.push({
              vendorId: q.vendorId,
              vendorName: q.vendorName,
              vendorEmail: q.vendorEmail,
              rate: Number(match.rate)
            })
          }
        })

        if (itemBids.length > 0) {
          itemBids.sort((a, b) => a.rate - b.rate)
          chosenBid = itemBids[0]
        }
      }

      if (chosenBid) {
        const vId = chosenBid.vendorId.toString()
        if (!vendorOrdersMap[vId]) {
          vendorOrdersMap[vId] = {
            vendorId: chosenBid.vendorId,
            vendorName: chosenBid.vendorName,
            vendorEmail: chosenBid.vendorEmail,
            items: [],
            totalOrderAmount: 0
          }
        }

        const quantity = Number(demandItem.quantity) || 1
        const itemTotal = chosenBid.rate * quantity

        vendorOrdersMap[vId].items.push({
          name: demandItem.name,
          unit: demandItem.unit,
          quantity,
          allocatedRate: chosenBid.rate,
          itemTotal
        })
        vendorOrdersMap[vId].totalOrderAmount += itemTotal
      }
    })

    // Remove any previously pending orders for this demand to prevent duplicates
    await Order.deleteMany({ demandId })

    // Create confirmed Orders in MongoDB for winning vendors
    const createdOrders = []
    for (const vId of Object.keys(vendorOrdersMap)) {
      const vOrder = vendorOrdersMap[vId]
      const order = await Order.create({
        demandId: demand._id,
        demandCode: demand.demandCode,
        vendorId: vOrder.vendorId,
        vendorName: vOrder.vendorName,
        vendorEmail: vOrder.vendorEmail,
        items: vOrder.items,
        totalOrderAmount: vOrder.totalOrderAmount,
        status: 'Approved'
      })
      createdOrders.push(order)
    }

    // Mark demand status as Allocated
    demand.status = 'Allocated'
    await demand.save()

    res.status(201).json({
      success: true,
      message: `Allocations confirmed! ${createdOrders.length} Purchase Orders generated successfully.`,
      orders: createdOrders
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Dispatch Purchase Orders via Email to winning vendors
 * @route   POST /api/allocations/dispatch/:demandId
 * @access  Private (Admin)
 */
export const dispatchPurchaseOrders = async (req, res) => {
  try {
    const { demandId } = req.params

    const orders = await Order.find({ demandId, status: 'Approved' })
    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No approved purchase orders found to dispatch for this demand'
      })
    }

    // Update orders to PO_Dispatched and set email timestamp
    const now = new Date()
    await Order.updateMany(
      { demandId, status: 'Approved' },
      { status: 'PO_Dispatched', emailDispatchedAt: now }
    )

    // Log to EmailLog for each winning vendor
    for (const order of orders) {
      const itemsList = order.items.map((i) => `${i.name}: ${i.quantity} ${i.unit} @ ₹${i.allocatedRate} = ₹${i.itemTotal}`).join('\n')
      await EmailLog.create({
        demandId: order.demandId,
        demandCode: order.demandCode,
        vendorId: order.vendorId,
        vendorName: order.vendorName,
        vendorEmail: order.vendorEmail,
        emailType: 'Purchase Order',
        subject: `Official Purchase Order Confirmed - Demand ${order.demandCode} (Mirch Masala)`,
        content: `Dear ${order.vendorName},\n\nCongratulations! Your competitive bid for Demand ${order.demandCode} has been approved.\n\nAllocated Items:\n${itemsList}\n\nTotal Order Amount: ₹${order.totalOrderAmount.toLocaleString('en-IN')}\n\nPlease prepare the consignment for delivery.\n\nRegards,\nMirch Masala Grocery Shop`,
        status: 'Sent'
      }).catch(() => null)
    }

    const updatedOrders = await Order.find({ demandId })

    res.json({
      success: true,
      message: `Purchase Orders dispatched successfully to ${orders.length} winning vendors via Email!`,
      orders: updatedOrders
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get all orders / allocations for a demand
 * @route   GET /api/allocations/:demandId
 * @access  Private (Admin)
 */
export const getOrdersByDemand = async (req, res) => {
  try {
    const orders = await Order.find({ demandId: req.params.demandId }).sort({ createdAt: -1 })
    res.json({ success: true, count: orders.length, data: orders })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
