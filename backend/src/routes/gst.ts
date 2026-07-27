// src/routes/gst.ts

import express, { Router } from 'express';
import auth from '../middleware/auth';
import { authorizeMember } from '../middleware/authorize';
import {
  generateGSTR1,
  generateGSTR3B,
  getGSTReturns,
  markGSTR1Filed,
  markGSTR3BFiled,
  getGstDashboardStats
} from '../controllers/gstController';

const router: Router = express.Router();

router.post('/gstr1/generate', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), generateGSTR1);
router.post('/gstr3b/generate', auth, authorizeMember(['OWNER', 'ADMIN']), generateGSTR3B);
router.get('/returns/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getGSTReturns);
router.post('/gstr1/filed', auth, authorizeMember(['OWNER', 'ADMIN']), markGSTR1Filed);
router.post('/gstr3b/filed', auth, authorizeMember(['OWNER', 'ADMIN']), markGSTR3BFiled);
router.get('/dashboard/:companyId', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getGstDashboardStats);

export default router;
