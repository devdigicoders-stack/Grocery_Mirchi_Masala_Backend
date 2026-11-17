import mongoose from 'mongoose'

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      default: ''
    },
    password: {
      type: String,
      required: true,
      default: 'vendor123'
    },
    profileImage: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    fcmTokens: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('Vendor', vendorSchema)
