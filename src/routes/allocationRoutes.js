import express from 'express'
import {
  getAllocationPreview,
  confirmAllocations,
  dispatchPurchaseOrders,
  getOrdersByDemand
} from '../controllers/allocationController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Allocation Preview & Calculation
router.get('/preview/:demandId', protectAdmin, getAllocationPreview)

// Confirm and lock allocations (creates Orders in MongoDB)
router.post('/confirm/:demandId', protectAdmin, confirmAllocations)

// Dispatch Purchase Orders via Email
router.post('/dispatch/:demandId', protectAdmin, dispatchPurchaseOrders)

// Get orders for a specific demand
router.get('/:demandId', protectAdmin, getOrdersByDemand)

export default router
