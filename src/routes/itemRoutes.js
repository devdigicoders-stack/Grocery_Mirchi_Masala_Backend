import express from 'express'
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  bulkImportItems,
  seedDefaultItems
} from '../controllers/itemController.js'
import { protectAdmin } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Seed default master items
router.post('/seed', protectAdmin, seedDefaultItems)

// Bulk import items from Excel / CSV
router.post('/bulk-import', protectAdmin, bulkImportItems)

// Master items CRUD
router.route('/')
  .get(protectAdmin, getItems)
  .post(protectAdmin, createItem)

router.route('/:id')
  .get(protectAdmin, getItemById)
  .put(protectAdmin, updateItem)
  .delete(protectAdmin, deleteItem)

export default router
