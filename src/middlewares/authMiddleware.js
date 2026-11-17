import jwt from 'jsonwebtoken'
import Admin from '../models/Admin.js'
import Vendor from '../models/Vendor.js'

export const generateToken = (id, role = 'admin') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  })
}

export const protectAdmin = async (req, res, next) => {
  let token

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      
      const admin = await Admin.findById(decoded.id).select('-password')
      if (!admin) {
        return res.status(401).json({ success: false, message: 'Admin account not found' })
      }

      req.admin = admin
      return next()
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed or expired' })
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' })
  }
}

/**
 * Protect Vendor Mobile App Routes
 */
export const protectVendor = async (req, res, next) => {
  let token

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      const vendor = await Vendor.findById(decoded.id)
      if (!vendor) {
        return res.status(401).json({ success: false, message: 'Vendor account not found' })
      }

      if (vendor.status !== 'Active') {
        return res.status(403).json({ success: false, message: 'Vendor account is inactive' })
      }

      req.vendor = vendor
      return next()
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' })
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' })
  }
}
