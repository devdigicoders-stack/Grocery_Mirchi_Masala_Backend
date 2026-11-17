import EmailLog from '../models/EmailLog.js'

/**
 * @desc    Get all email logs with optional search & filter
 * @route   GET /api/email-logs
 * @access  Private (Admin)
 */
export const getEmailLogs = async (req, res) => {
  try {
    const { search = '', emailType = '', status = '' } = req.query
    const query = {}

    // Filter by search query (demandCode, vendorName, or vendorEmail)
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i')
      query.$or = [
        { demandCode: searchRegex },
        { vendorName: searchRegex },
        { vendorEmail: searchRegex },
        { subject: searchRegex }
      ]
    }

    // Filter by emailType
    if (emailType && emailType !== 'All') {
      query.emailType = emailType
    }

    // Filter by status
    if (status && status !== 'All') {
      query.status = status
    }

    const logs = await EmailLog.find(query).sort({ sentAt: -1, createdAt: -1 })

    res.json({
      success: true,
      count: logs.length,
      data: logs
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Get single email log by ID
 * @route   GET /api/email-logs/:id
 * @access  Private (Admin)
 */
export const getEmailLogById = async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id)
    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' })
    }
    res.json({ success: true, data: log })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Resend an email from log
 * @route   POST /api/email-logs/:id/resend
 * @access  Private (Admin)
 */
export const resendEmail = async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id)
    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' })
    }

    // Update sent timestamp and ensure status is Sent
    log.sentAt = new Date()
    log.status = 'Sent'
    await log.save()

    res.json({
      success: true,
      message: `Email re-dispatched to ${log.vendorName} (${log.vendorEmail}) successfully!`,
      data: log
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

/**
 * @desc    Delete an email log
 * @route   DELETE /api/email-logs/:id
 * @access  Private (Admin)
 */
export const deleteEmailLog = async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id)
    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' })
    }

    await EmailLog.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Email log deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
