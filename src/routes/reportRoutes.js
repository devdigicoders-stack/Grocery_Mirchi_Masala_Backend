import express from 'express'
import {
  getDemandSummaryReport,
  getVendorPerformanceReport,
  getItemWiseRateReport,
  getDashboardOverview
} from '../controllers/reportController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/dashboard-overview', protectAdmin, getDashboardOverview)
router.get('/demand-summary', protectAdmin, getDemandSummaryReport)
router.get('/vendor-performance', protectAdmin, getVendorPerformanceReport)
router.get('/item-rates', protectAdmin, getItemWiseRateReport)

export default router
