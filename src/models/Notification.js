import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['new_demand', 'bidding_reminder', 'order_allocated', 'custom_broadcast', 'system_alert'],
      default: 'system_alert'
    },
    targetType: {
      type: String,
      enum: ['all', 'single'],
      default: 'all'
    },
    targetVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null
    },
    targetVendorName: {
      type: String,
      default: ''
    },
    metadata: {
      demandId: { type: String, default: '' },
      demandCode: { type: String, default: '' },
      orderId: { type: String, default: '' },
      url: { type: String, default: '' }
    },
    fcmSuccessCount: {
      type: Number,
      default: 0
    },
    fcmFailureCount: {
      type: Number,
      default: 0
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor'
      }
    ],
    sentByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('Notification', notificationSchema)
