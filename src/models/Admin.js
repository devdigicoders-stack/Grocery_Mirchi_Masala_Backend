import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Admin'
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      default: '+91 98765 43210'
    },
    shopName: {
      type: String,
      default: 'Mirch Masala Grocery Shop'
    },
    address: {
      type: String,
      default: 'Shop #12, Grain Market, Lucknow'
    },
    gstin: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      default: 'admin'
    },
    settings: {
      emailSettings: {
        smtpHost: { type: String, default: 'smtp.mailgun.org' },
        smtpPort: { type: String, default: '587' },
        senderEmail: { type: String, default: 'notifications@mirchmasala.com' },
        encryption: { type: String, default: 'TLS' }
      },
      systemSettings: {
        defaultBiddingHours: { type: Number, default: 48 },
        autoAllocationRule: { type: String, default: 'Lowest Rate First' },
        currency: { type: String, default: 'INR (₹)' },
        autoCloseOnDeadline: { type: Boolean, default: true },
        notifyVendorsOnPublish: { type: Boolean, default: true }
      }
    }
  },
  {
    timestamps: true
  }
)

// Compare candidate password with stored hash
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

// Pre-save hook to hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next()
  }
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

export default mongoose.model('Admin', adminSchema)
