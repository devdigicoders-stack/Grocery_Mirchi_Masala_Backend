import Notification from '../models/Notification.js'
import Vendor from '../models/Vendor.js'
import {
  sendPushToAllVendors,
  sendPushToVendor,
  registerFcmToken,
  removeFcmToken,
  isFirebaseReady
} from '../services/notificationService.js'

/**
 * @desc    Get all notifications (Admin)
 * @route   GET /api/notifications
 * @access  Private (Admin)
 */
export const getAdminNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    const [notifications, total] = await Promise.all([
      Notification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sentByAdminId', 'name email')
        .populate('targetVendorId', 'name email'),
      Notification.countDocuments()
    ])

    res.json({
      success: true,
      data: notifications,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get notifications for logged-in vendor
 * @route   GET /api/notifications/vendor
 * @access  Private (Vendor)
 */
export const getVendorNotifications = async (req, res) => {
  try {
    const vendorId = req.vendor?._id || req.vendor?.id
    if (!vendorId) {
      return res.status(401).json({ success: false, message: 'Vendor unauthorized' })
    }

    const notifications = await Notification.find({
      $or: [{ targetType: 'all' }, { targetVendorId: vendorId }]
    })
      .sort({ createdAt: -1 })
      .limit(50)

    // Calculate unread count for this vendor
    const unreadCount = notifications.filter(
      (n) => !n.readBy.some((r) => r.toString() === vendorId.toString())
    ).length

    res.json({
      success: true,
      unreadCount,
      data: notifications
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Mark a notification as read
 * @route   POST /api/notifications/:id/read
 * @access  Private (Vendor)
 */
export const markNotificationRead = async (req, res) => {
  try {
    const vendorId = req.vendor?._id || req.vendor?.id
    const { id } = req.params

    const notification = await Notification.findByIdAndUpdate(
      id,
      { $addToSet: { readBy: vendorId } },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' })
    }

    res.json({ success: true, data: notification })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Mark all notifications as read for vendor
 * @route   POST /api/notifications/vendor/mark-all-read
 * @access  Private (Vendor)
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const vendorId = req.vendor?._id || req.vendor?.id
    if (!vendorId) {
      return res.status(401).json({ success: false, message: 'Vendor unauthorized' })
    }

    await Notification.updateMany(
      { $or: [{ targetType: 'all' }, { targetVendorId: vendorId }] },
      { $addToSet: { readBy: vendorId } }
    )

    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Send custom notification / broadcast (Admin)
 * @route   POST /api/notifications/broadcast
 * @access  Private (Admin)
 */
export const broadcastNotification = async (req, res) => {
  try {
    const { title, body, targetType, targetVendorId, type = 'custom_broadcast', data = {} } = req.body

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' })
    }

    const adminId = req.admin?._id || req.admin?.id

    let result
    if (targetType === 'single' && targetVendorId) {
      result = await sendPushToVendor(targetVendorId, {
        title,
        body,
        data,
        type,
        sentByAdminId: adminId
      })
    } else {
      result = await sendPushToAllVendors({
        title,
        body,
        data,
        type,
        sentByAdminId: adminId
      })
    }

    res.json({
      success: true,
      message: 'Notification dispatched successfully',
      result
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Save/Register FCM Token from Vendor App
 * @route   POST /api/notifications/fcm-token
 * @access  Private (Vendor)
 */
export const saveFcmToken = async (req, res) => {
  try {
    const vendorId = req.vendor?._id || req.vendor?.id
    const { fcmToken } = req.body

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' })
    }

    const saved = await registerFcmToken(vendorId, fcmToken)
    res.json({
      success: saved,
      message: saved ? 'FCM token registered' : 'Failed to register token'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Remove FCM Token on Logout
 * @route   POST /api/notifications/fcm-token/remove
 * @access  Private (Vendor)
 */
export const deleteFcmToken = async (req, res) => {
  try {
    const vendorId = req.vendor?._id || req.vendor?.id
    const { fcmToken } = req.body

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' })
    }

    const removed = await removeFcmToken(vendorId, fcmToken)
    res.json({
      success: removed,
      message: removed ? 'FCM token removed' : 'Failed to remove token'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Notification System Health / Status
 * @route   GET /api/notifications/status
 * @access  Private (Admin)
 */
export const getNotificationStatus = async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments({ status: 'Active' })
    const registeredVendors = await Vendor.countDocuments({
      status: 'Active',
      fcmTokens: { $exists: true, $ne: [] }
    })

    res.json({
      success: true,
      firebaseReady: isFirebaseReady(),
      totalVendors,
      registeredVendorsWithTokens: registeredVendors
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
