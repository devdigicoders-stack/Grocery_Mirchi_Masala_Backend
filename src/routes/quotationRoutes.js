import express from 'express'
import {
  getQuotations,
  getQuotationsByDemand,
  getComparisonMatrix,
  submitQuotation,
  deleteQuotation
} from '../controllers/quotationController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Admin comparison & listing routes
router.get('/', protectAdmin, getQuotations)
router.get('/compare/:demandId', protectAdmin, getComparisonMatrix)
router.get('/demand/:demandId', protectAdmin, getQuotationsByDemand)
router.delete('/:id', protectAdmin, deleteQuotation)

// Quotation submission (can be called by authenticated admin or vendor)
router.post('/submit', protectAdmin, submitQuotation)

export default router
