import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Vendor from '../models/Vendor.js'
import Notification from '../models/Notification.js'
import { broadcastRealtimeEvent } from '../utils/realtime.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let isFirebaseInitialized = false
let messagingInstance = null

/**
 * Initialize Firebase Admin SDK
 * Priority 1: Service Account JSON file (backend/serviceAccountKey.json or root)
 * Priority 2: Credentials in .env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 */
export const initializeFirebase = () => {
  if (isFirebaseInitialized && messagingInstance) {
    return true
  }

  try {
    let app = null

    // 1. Check for Service Account JSON file in multiple standard locations
    const candidatePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      path.join(__dirname, '../../serviceAccountKey.json'),
      path.join(__dirname, '../serviceAccountKey.json'),
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'backend/serviceAccountKey.json')
    ].filter(Boolean)

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'))
          const apps = getApps()
          app = apps.length > 0 ? apps[0] : initializeApp({ credential: cert(serviceAccount) })
          messagingInstance = getMessaging(app)
          isFirebaseInitialized = true
          console.log(`🔥 [Firebase Admin] Connected successfully to Project: ${serviceAccount.project_id}`)
          return true
        } catch (e) {
          console.warn(`[Firebase Admin] Failed reading candidate path ${p}:`, e.message)
        }
      }
    }

    // 2. Fallback to environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID || 'tt-crm-f6a6c'
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (clientEmail && privateKey) {
      // Handle escaped newlines in private key
      privateKey = privateKey.replace(/\\n/g, '\n')

      const apps = getApps()
      app =
        apps.length > 0
          ? apps[0]
          : initializeApp({
              credential: cert({
                projectId,
                clientEmail,
                privateKey
              })
            })
      messagingInstance = getMessaging(app)
      isFirebaseInitialized = true
      console.log(`🔥 [Firebase Admin] Initialized successfully using .env credentials (Project: ${projectId})`)
      return true
    }

    console.warn(
      '⚠️  [Firebase Admin] Credentials not found in serviceAccountKey.json or .env.\n' +
        '    Push notifications will be broadcast via Real-Time SSE.\n'
    )
    return false
  } catch (error) {
    console.error('❌ [Firebase Admin] Initialization failed:', error.message)
    return false
  }
}

/**
 * Check if Firebase Admin is currently active and ready
 */
export const isFirebaseReady = () => isFirebaseInitialized && messagingInstance !== null

/**
 * Register or update FCM Token for a vendor
 */
export const registerFcmToken = async (vendorId, fcmToken) => {
  if (!vendorId || !fcmToken) return false
  try {
    const vendor = await Vendor.findById(vendorId)
    if (!vendor) return false

    if (!vendor.fcmTokens) {
      vendor.fcmTokens = []
    }

    if (!vendor.fcmTokens.includes(fcmToken)) {
      vendor.fcmTokens.push(fcmToken)
      await vendor.save()
      console.log(`📱 [FCM] Token registered for vendor ${vendor.name} (${vendor._id})`)
    }
    return true
  } catch (err) {
    console.error('Error registering FCM token:', err.message)
    return false
  }
}

/**
 * Remove an invalid or logged-out FCM Token
 */
export const removeFcmToken = async (vendorId, fcmToken) => {
  if (!vendorId || !fcmToken) return false
  try {
    await Vendor.findByIdAndUpdate(vendorId, {
      $pull: { fcmTokens: fcmToken }
    })
    return true
  } catch (err) {
    return false
  }
}

/**
 * Helper to cleanup invalid/stale tokens after send failure
 */
const cleanupStaleTokens = async (vendorId, invalidTokens = []) => {
  if (!invalidTokens.length) return
  try {
    if (vendorId) {
      await Vendor.findByIdAndUpdate(vendorId, {
        $pull: { fcmTokens: { $in: invalidTokens } }
      })
    } else {
      await Vendor.updateMany(
        { fcmTokens: { $in: invalidTokens } },
        { $pull: { fcmTokens: { $in: invalidTokens } } }
      )
    }
    console.log(`🧹 [FCM] Cleaned up ${invalidTokens.length} expired/invalid device tokens`)
  } catch (err) {
    console.warn('Failed to clean up stale FCM tokens:', err.message)
  }
}

/**
 * Send Push Notification to ALL Active Vendors
 */
export const sendPushToAllVendors = async ({
  title,
  body,
  data = {},
  type = 'system_alert',
  sentByAdminId = null
}) => {
  try {
    // 1. Save in MongoDB Notification Collection
    const notificationDoc = await Notification.create({
      title,
      body,
      type,
      targetType: 'all',
      metadata: {
        demandId: data.demandId || '',
        demandCode: data.demandCode || '',
        orderId: data.orderId || '',
        url: data.url || ''
      },
      sentByAdminId
    })

    // 2. Broadcast via Real-time SSE to both Vendor App & Admin Panel
    broadcastRealtimeEvent('NEW_NOTIFICATION', {
      notificationId: notificationDoc._id,
      title,
      body,
      type,
      targetType: 'all',
      data,
      sound: 'alert',
      createdAt: notificationDoc.createdAt
    })

    // 3. Send Push via Firebase FCM if initialized
    if (!isFirebaseInitialized || !messagingInstance) {
      console.log(`📢 [Push Broadcast] (SSE Only) "${title}" - ${body}`)
      return { success: true, sseOnly: true, notification: notificationDoc }
    }

    const vendors = await Vendor.find({
      status: 'Active',
      fcmTokens: { $exists: true, $ne: [] }
    }).select('_id name fcmTokens')

    const allTokens = []

    for (const v of vendors) {
      if (Array.isArray(v.fcmTokens)) {
        for (const token of v.fcmTokens) {
          if (token && typeof token === 'string' && token.trim().length > 10) {
            allTokens.push(token)
          }
        }
      }
    }

    if (allTokens.length === 0) {
      console.log(`ℹ️ [FCM] No registered vendor device tokens found yet`)
      return { success: true, count: 0, notification: notificationDoc }
    }

    // Convert all data payload properties to strings (FCM requirement)
    const stringData = {}
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = String(value ?? '')
    }
    stringData.notificationId = String(notificationDoc._id)
    stringData.type = type

    const message = {
      notification: {
        title,
        body
      },
      data: stringData,
      tokens: allTokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'mirchi_masala_alerts',
          color: '#074824',
          icon: 'ic_launcher'
        }
      }
    }

    const response = await messagingInstance.sendEachForMulticast(message)
    console.log(
      `🚀 [FCM Multicast] Sent to ${allTokens.length} devices: ${response.successCount} success, ${response.failureCount} failed`
    )

    // Update notification doc with delivery counts
    notificationDoc.fcmSuccessCount = response.successCount
    notificationDoc.fcmFailureCount = response.failureCount
    await notificationDoc.save()

    // Handle token cleanup for invalid/unregistered devices
    const tokensToRemove = []
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(allTokens[idx])
        }
      }
    })

    if (tokensToRemove.length > 0) {
      await cleanupStaleTokens(null, tokensToRemove)
    }

    return {
      success: true,
      fcmSuccessCount: response.successCount,
      fcmFailureCount: response.failureCount,
      notification: notificationDoc
    }
  } catch (error) {
    console.error('Error in sendPushToAllVendors:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Send Push Notification to a SPECIFIC Vendor
 */
export const sendPushToVendor = async (
  vendorId,
  { title, body, data = {}, type = 'system_alert', sentByAdminId = null }
) => {
  try {
    const vendor = await Vendor.findById(vendorId)
    if (!vendor) return { success: false, message: 'Vendor not found' }

    // 1. Save in MongoDB Notification Collection
    const notificationDoc = await Notification.create({
      title,
      body,
      type,
      targetType: 'single',
      targetVendorId: vendor._id,
      targetVendorName: vendor.name,
      metadata: {
        demandId: data.demandId || '',
        demandCode: data.demandCode || '',
        orderId: data.orderId || '',
        url: data.url || ''
      },
      sentByAdminId
    })

    // 2. Broadcast via Real-time SSE
    broadcastRealtimeEvent('NEW_NOTIFICATION', {
      notificationId: notificationDoc._id,
      title,
      body,
      type,
      targetType: 'single',
      targetVendorId: vendor._id,
      data,
      sound: 'alert',
      createdAt: notificationDoc.createdAt
    })

    // 3. Send Push via Firebase FCM
    if (!isFirebaseInitialized || !messagingInstance) {
      console.log(`📢 [Vendor Push] (SSE Only) To ${vendor.name}: "${title}" - ${body}`)
      return { success: true, sseOnly: true, notification: notificationDoc }
    }

    const tokens = (vendor.fcmTokens || []).filter(
      (t) => t && typeof t === 'string' && t.trim().length > 10
    )

    if (tokens.length === 0) {
      console.log(`ℹ️ [FCM] No registered device tokens for vendor ${vendor.name}`)
      return { success: true, count: 0, notification: notificationDoc }
    }

    const stringData = {}
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = String(value ?? '')
    }
    stringData.notificationId = String(notificationDoc._id)
    stringData.type = type

    const message = {
      notification: {
        title,
        body
      },
      data: stringData,
      tokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'mirchi_masala_alerts',
          color: '#074824',
          icon: 'ic_launcher'
        }
      }
    }

    const response = await messagingInstance.sendEachForMulticast(message)
    console.log(
      `🚀 [FCM Single Vendor] Sent to ${vendor.name} (${tokens.length} devices): ${response.successCount} success`
    )

    notificationDoc.fcmSuccessCount = response.successCount
    notificationDoc.fcmFailureCount = response.failureCount
    await notificationDoc.save()

    // Clean up stale tokens
    const tokensToRemove = []
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(tokens[idx])
        }
      }
    })

    if (tokensToRemove.length > 0) {
      await cleanupStaleTokens(vendor._id, tokensToRemove)
    }

    return {
      success: true,
      fcmSuccessCount: response.successCount,
      notification: notificationDoc
    }
  } catch (error) {
    console.error('Error in sendPushToVendor:', error.message)
    return { success: false, error: error.message }
  }
}
