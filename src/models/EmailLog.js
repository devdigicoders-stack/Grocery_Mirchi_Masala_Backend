import mongoose from 'mongoose'

const emailLogSchema = new mongoose.Schema(
  {
    demandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Demand'
    },
    demandCode: {
      type: String,
      default: 'General'
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    vendorName: {
      type: String,
      required: true
    },
    vendorEmail: {
      type: String,
      required: true
    },
    emailType: {
      type: String,
      enum: [
        'Purchase Order',
        'Demand Notification',
        'Bidding Reminder',
        'APK App Invite',
        'Bidding Outcome',
        'General'
      ],
      default: 'General'
    },
    subject: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['Sent', 'Delivered', 'Failed'],
      default: 'Sent'
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('EmailLog', emailLogSchema)
