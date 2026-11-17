import express from 'express'
import {
  getEmailLogs,
  getEmailLogById,
  resendEmail,
  deleteEmailLog
} from '../controllers/emailLogController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', protectAdmin, getEmailLogs)
router.get('/:id', protectAdmin, getEmailLogById)
router.post('/:id/resend', protectAdmin, resendEmail)
router.delete('/:id', protectAdmin, deleteEmailLog)

export default router
