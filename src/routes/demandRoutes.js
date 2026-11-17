import express from 'express'
import {
  getDemands,
  getActiveDemand,
  getDemandById,
  createDemand,
  getDemandSubmissions,
  sendVendorReminder,
  sendBulkReminder,
  closeDemandBidding,
  deleteDemand
} from '../controllers/demandController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'
import { handleRealtimeConnection } from '../utils/realtime.js'

const router = express.Router()

// Real-time SSE Live Stream (Instant push notifications for Vendor App & Admin)
router.get('/live-stream', handleRealtimeConnection)

// Public / Protected endpoints
router.get('/', protectAdmin, getDemands)
router.get('/active', protectAdmin, getActiveDemand)
router.get('/:id', protectAdmin, getDemandById)
router.post('/', protectAdmin, createDemand)
router.delete('/:id', protectAdmin, deleteDemand)

// Submissions & Reminders
router.get('/:id/submissions', protectAdmin, getDemandSubmissions)
router.post('/:id/remind/:vendorId', protectAdmin, sendVendorReminder)
router.post('/:id/remind-all', protectAdmin, sendBulkReminder)
router.put('/:id/close', protectAdmin, closeDemandBidding)

export default router
