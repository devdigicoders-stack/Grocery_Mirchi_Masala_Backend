import express from 'express'
import {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  updateSettings,
  changeAdminPassword
} from '../controllers/authController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Public auth routes
router.post('/register', registerAdmin)
router.post('/login', loginAdmin)

// Protected admin profile & configuration routes
router.get('/profile', protectAdmin, getAdminProfile)
router.put('/profile', protectAdmin, updateAdminProfile)
router.put('/settings', protectAdmin, updateSettings)
router.put('/change-password', protectAdmin, changeAdminPassword)

export default router
