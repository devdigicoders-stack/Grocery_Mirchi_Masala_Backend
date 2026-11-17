import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: 'KG'
    },
    category: {
      type: String,
      trim: true,
      default: 'General Grocery'
    },
    packSize: {
      type: String,
      trim: true,
      default: ''
    },
    specifications: {
      type: String,
      trim: true,
      default: ''
    },
    referencePrice: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

// Index for fast searching
itemSchema.index({ name: 'text', category: 'text' })

export default mongoose.model('Item', itemSchema)
