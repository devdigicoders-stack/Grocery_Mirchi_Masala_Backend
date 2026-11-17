import express from 'express'
import {
  getAdminNotifications,
  getVendorNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  broadcastNotification,
  saveFcmToken,
  deleteFcmToken,
  getNotificationStatus
} from '../controllers/notificationController.js'
import { protectAdmin, protectVendor } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Admin Routes
router.get('/', protectAdmin, getAdminNotifications)
router.get('/status', protectAdmin, getNotificationStatus)
router.post('/broadcast', protectAdmin, broadcastNotification)

// Vendor Routes
router.get('/vendor', protectVendor, getVendorNotifications)
router.post('/vendor/mark-all-read', protectVendor, markAllNotificationsRead)
router.post('/:id/read', protectVendor, markNotificationRead)
router.post('/fcm-token', protectVendor, saveFcmToken)
router.post('/fcm-token/remove', protectVendor, deleteFcmToken)

export default router
