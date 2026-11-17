import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema({
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
  allocatedRate: {
    type: Number,
    required: true
  },
  itemTotal: {
    type: Number,
    required: true
  }
})

const orderSchema = new mongoose.Schema(
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
    vendorName: {
      type: String,
      required: true
    },
    vendorEmail: {
      type: String,
      required: true
    },
    items: [orderItemSchema],
    totalOrderAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending_Approval', 'Approved', 'PO_Dispatched', 'Rejected'],
      default: 'Pending_Approval'
    },
    emailDispatchedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model('Order', orderSchema)
