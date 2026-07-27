// src/routes/tds.ts

import express, { Router } from 'express';
import auth from '../middleware/auth';
import { authorizeMember } from '../middleware/authorize';
import {
  createTDSRecord,
  updateTDSRecord,
  deleteTDSRecord,
  getTDSRecords,
  generateForm26Q,
  saveForm26Q,
  getTDSReturns,
  markForm26QFiled,
  getTdsDashboardStats
} from '../controllers/tdsController';

const router: Router = express.Router();

// Record routes
router.post('/records', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), createTDSRecord);
router.put('/records/:id', auth, updateTDSRecord);
router.delete('/records/:id', auth, deleteTDSRecord);
router.get('/records/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getTDSRecords);

// Form 26Q return routes
router.post('/form26q/generate', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), generateForm26Q);
router.post('/form26q/save', auth, authorizeMember(['OWNER', 'ADMIN']), saveForm26Q);
router.get('/returns/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getTDSReturns);
router.post('/form26q/filed', auth, authorizeMember(['OWNER', 'ADMIN']), markForm26QFiled);

// Dashboard route
router.get('/dashboard/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getTdsDashboardStats);

export default router;
