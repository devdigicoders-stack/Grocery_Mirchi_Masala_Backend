import Admin from '../models/Admin.js'
import { generateToken } from '../middlewares/authMiddleware.js'

/**
 * @desc    Auto-seed default admin if database is empty
 */
export const seedDefaultAdminIfNeeded = async () => {
  try {
    const adminCount = await Admin.countDocuments()
    if (adminCount === 0) {
      await Admin.create({
        name: 'Admin',
        email: 'admin@mirchmasala.com',
        password: 'admin123',
        phone: '+91 98765 43210',
        shopName: 'Mirch Masala Grocery Shop',
        role: 'admin',
        address: 'Shop #12, Grain Market, Lucknow',
        gstin: '',
        settings: {
          emailSettings: {
            smtpHost: 'smtp.mailgun.org',
            smtpPort: '587',
            senderEmail: 'notifications@mirchmasala.com',
            encryption: 'TLS'
          },
          systemSettings: {
            defaultBiddingHours: 48,
            autoAllocationRule: 'Lowest Rate First',
            currency: 'INR (₹)',
            autoCloseOnDeadline: true,
            notifyVendorsOnPublish: true
          }
        }
      })
      console.log('🌱 Initial Admin account seeded: admin@mirchmasala.com / admin123')
    }
  } catch (error) {
    console.error('Error seeding default admin:', error.message)
  }
}

/**
 * @desc    Create / Register a new Admin
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone, shopName, address, gstin } = req.body

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' })
    }

    const adminExists = await Admin.findOne({ email: email.toLowerCase().trim() })
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Admin with this email already exists' })
    }

    const admin = await Admin.create({
      name: name || 'Admin',
      email: email.toLowerCase().trim(),
      password,
      phone: phone || '+91 98765 43210',
      shopName: shopName || 'Mirch Masala Grocery Shop',
      address: address || 'Shop #12, Grain Market, Lucknow',
      gstin: gstin || ''
    })

    const token = generateToken(admin._id)

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      token,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        shopName: admin.shopName,
        address: admin.address,
        gstin: admin.gstin,
        role: admin.role,
        settings: admin.settings
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Admin Login
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginAdmin = async (req, res) => {
  try {
    const { email, loginId, identifier, username, phone, password } = req.body
    const inputIdentifier = (email || loginId || identifier || username || phone || '').toString().trim()

    if (!inputIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide login identifier and password' })
    }

    // Auto-seed if database is brand new
    await seedDefaultAdminIfNeeded()

    const admin = await Admin.findOne({
      $or: [
        { email: inputIdentifier.toLowerCase() },
        { phone: inputIdentifier },
        { phone: inputIdentifier.replace(/^(\+91|0)/, '').trim() },
        { name: new RegExp(`^${inputIdentifier}$`, 'i') }
      ]
    })
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or password' })
    }

    const isMatch = await admin.matchPassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or password' })
    }

    const token = generateToken(admin._id)

    res.json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        shopName: admin.shopName,
        address: admin.address,
        gstin: admin.gstin,
        role: admin.role,
        settings: admin.settings
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get Current Admin Profile & Settings
 * @route   GET /api/auth/profile
 * @access  Private (Admin)
 */
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password')
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' })
    }

    res.json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        shopName: admin.shopName,
        address: admin.address || '',
        gstin: admin.gstin || '',
        role: admin.role,
        settings: admin.settings || {},
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Update Admin Profile (Shop Details)
 * @route   PUT /api/auth/profile
 * @access  Private (Admin)
 */
export const updateAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id)
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' })
    }

    const { name, email, phone, shopName, address, gstin } = req.body

    // Check if new email is already taken by another admin
    if (email && email.toLowerCase().trim() !== admin.email) {
      const emailExists = await Admin.findOne({
        _id: { $ne: admin._id },
        email: email.toLowerCase().trim()
      })
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email address is already in use by another account' })
      }
      admin.email = email.toLowerCase().trim()
    }

    if (name) admin.name = name.trim()
    if (phone) admin.phone = phone.trim()
    if (shopName) admin.shopName = shopName.trim()
    if (address !== undefined) admin.address = address.trim()
    if (gstin !== undefined) admin.gstin = gstin.trim()

    // Allow updating password directly from profile update if provided
    const passToChange = newPassword || password
    if (passToChange && passToChange.trim().length > 0) {
      if (passToChange.trim().length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' })
      }
      admin.password = passToChange.trim()
    }

    const updatedAdmin = await admin.save()

    res.json({
      success: true,
      message: 'Shop details and credentials updated successfully',
      data: {
        _id: updatedAdmin._id,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        phone: updatedAdmin.phone,
        shopName: updatedAdmin.shopName,
        address: updatedAdmin.address,
        gstin: updatedAdmin.gstin,
        role: updatedAdmin.role,
        settings: updatedAdmin.settings,
        updatedAt: updatedAdmin.updatedAt
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Update System & Email Settings
 * @route   PUT /api/auth/settings
 * @access  Private (Admin)
 */
export const updateSettings = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id)
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' })
    }

    const { emailSettings, systemSettings } = req.body

    if (!admin.settings) {
      admin.settings = {}
    }

    if (emailSettings) {
      admin.settings.emailSettings = {
        ...admin.settings.emailSettings,
        ...emailSettings
      }
    }

    if (systemSettings) {
      admin.settings.systemSettings = {
        ...admin.settings.systemSettings,
        ...systemSettings
      }
    }

    // Mark modified for nested objects
    admin.markModified('settings')
    await admin.save()

    res.json({
      success: true,
      message: 'Configuration settings updated successfully in MongoDB',
      data: admin.settings
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Change Admin Password
 * @route   PUT /api/auth/change-password
 * @access  Private (Admin)
 */
export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide both current and new password' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' })
    }

    const admin = await Admin.findById(req.admin._id)
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found' })
    }

    const isMatch = await admin.matchPassword(currentPassword)
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' })
    }

    admin.password = newPassword
    await admin.save()

    res.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
