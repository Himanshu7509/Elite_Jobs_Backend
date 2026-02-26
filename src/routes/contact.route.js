import express from 'express';
import { 
  createContact,
  getAllContacts,
  getContactById,
  updateContact,
  deleteContact,
  getContactStats
} from '../controllers/contact.controller.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware.js';

const contactRouter = express.Router();

// Public route - Anyone can submit contact form
contactRouter.post('/', createContact);

// Protected routes - Admin only
contactRouter.get('/', authMiddleware, authorizeRole('admin'), getAllContacts);
contactRouter.get('/stats', authMiddleware, authorizeRole('admin'), getContactStats);
contactRouter.get('/:id', authMiddleware, authorizeRole('admin'), getContactById);
contactRouter.put('/:id', authMiddleware, authorizeRole('admin'), updateContact);
contactRouter.delete('/:id', authMiddleware, authorizeRole('admin'), deleteContact);

export default contactRouter;