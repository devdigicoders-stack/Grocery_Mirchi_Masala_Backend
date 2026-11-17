import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'
import connectDB from './config/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import routes
import authRoutes from './routes/authRoutes.js'
import vendorRoutes from './routes/vendorRoutes.js'
import itemRoutes from './routes/itemRoutes.js'
import demandRoutes from './routes/demandRoutes.js'
import quotationRoutes from './routes/quotationRoutes.js'
import allocationRoutes from './routes/allocationRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import emailLogRoutes from './routes/emailLogRoutes.js'

// Import error middlewares
import { notFound, errorHandler } from './middlewares/errorHandler.js'

// Load environment variables from .env (checks both local and backend directory)
dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config()

// Connect to MongoDB Database
connectDB()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Mirch Masala Grocery Shop B2B API',
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(0)} seconds`
  })
})

// Mount API routes
app.use('/api/auth', authRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/demands', demandRoutes)
app.use('/api/quotations', quotationRoutes)
app.use('/api/allocations', allocationRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/email-logs', emailLogRoutes)

// Error handling middlewares
app.use(notFound)
app.use(errorHandler)

const PORT = process.env.PORT || 5000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} (0.0.0.0)`)
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`)
  console.log(`🔗 Network Access: http://192.168.1.67:${PORT}/api/health`)
})
