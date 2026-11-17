import mongoose from 'mongoose'

const demandItemSchema = new mongoose.Schema({
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
  }
})

const demandSchema = new mongoose.Schema(
  {
    demandCode: {
      type: String,
      required: true,
      unique: true // e.g. "DM-0013"
    },
    items: [demandItemSchema],
    publishedAt: {
      type: Date,
      default: Date.now
    },
    deadlineAt: {
      type: Date,
      required: true // publishedAt + 48 hours
    },
    durationHours: {
      type: Number,
      default: 48
    },
    status: {
      type: String,
      enum: ['Active', 'Bidding_Closed', 'Allocated', 'Completed', 'Cancelled'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('Demand', demandSchema)
