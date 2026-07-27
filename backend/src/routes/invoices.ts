// src/routes/invoices.ts

import express, { Router } from 'express';
import auth from '../middleware/auth';
import { authorizeMember } from '../middleware/authorize';
import {
  createInvoice,
  updateInvoice,
  getInvoicesByCompany,
  deleteInvoice
} from '../controllers/invoiceController';

const router: Router = express.Router();

router.post('/', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), createInvoice);
router.put('/:id', auth, updateInvoice);
router.get('/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getInvoicesByCompany);
router.delete('/:id', auth, deleteInvoice);

export default router;