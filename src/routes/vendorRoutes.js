import express from 'express'
import {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  sendVendorApkInvite,
  sendBulkApkInvite,
  vendorLogin,
  getVendorProfile,
  updateVendorProfile,
  getVendorDashboard,
  getVendorDemandDetails,
  getVendorFinalResult,
  submitVendorQuotation
} from '../controllers/vendorController.js'
import { protectAdmin, protectVendor } from '../middlewares/authMiddleware.js'
import { uploadVendorImage } from '../middlewares/uploadMiddleware.js'

const router = express.Router()

// Public Vendor Mobile App Login (Email + Password)
router.post('/login', vendorLogin)

// Protected Vendor Mobile App Endpoints
router.get('/profile', protectVendor, getVendorProfile)
router.put('/profile', protectVendor, uploadVendorImage.single('profileImage'), updateVendorProfile)
router.get('/dashboard', protectVendor, getVendorDashboard)
router.get('/demands/:id', protectVendor, getVendorDemandDetails)
router.get('/demands/:id/final-result', protectVendor, getVendorFinalResult)
router.post('/quotations', protectVendor, submitVendorQuotation)

// Protected Admin Vendor Management Endpoints
router.route('/')
  .get(protectAdmin, getVendors)
  .post(protectAdmin, uploadVendorImage.single('profileImage'), createVendor)

router.post('/send-bulk-invite', protectAdmin, sendBulkApkInvite)

router.route('/:id')
  .get(protectAdmin, getVendorById)
  .put(protectAdmin, uploadVendorImage.single('profileImage'), updateVendor)
  .delete(protectAdmin, deleteVendor)

router.post('/:id/send-invite', protectAdmin, sendVendorApkInvite)

export default router
