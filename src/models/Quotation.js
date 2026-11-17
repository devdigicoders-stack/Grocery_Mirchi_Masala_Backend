
import mongoose from 'mongoose'

const quotedItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item'
  },
  name: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  rate: {
    type: Number,
    required: true // Vendor's quoted rate per unit
  }
})

const quotationSchema = new mongoose.Schema(
  {
    demandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Demand',
      required: true
    },
    demandCode: {
      type: String,
      required: true
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    vendorEmail: {
      type: String,
      required: true
    },
    vendorName: {
      type: String,
      required: true
    },
    quotedItems: [quotedItemSchema],
    totalQuoteAmount: {
      type: Number,
      default: 0
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('Quotation', quotationSchema)
