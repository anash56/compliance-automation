// src/routes/companies.ts

import express, { Router } from 'express';
import auth from '../middleware/auth';
import { authorizeMember } from '../middleware/authorize';
import {
  getCompanies,
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyMembers,
  addCompanyMember,
  deleteCompanyMember,
  getDashboardStats,
  updateTaskStatus
} from '../controllers/companyController';

const router: Router = express.Router();

// Company Workspace Routes
router.get('/', auth, getCompanies);
router.post('/', auth, createCompany);
router.get('/:id', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getCompanyById);
router.put('/:id', auth, authorizeMember(['OWNER', 'ADMIN']), updateCompany);
router.delete('/:id', auth, authorizeMember(['OWNER']), deleteCompany);

// Team Management Routes
router.get('/:id/members', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getCompanyMembers);
router.post('/:id/members', auth, authorizeMember(['OWNER', 'ADMIN']), addCompanyMember);
router.delete('/:id/members/:userId', auth, authorizeMember(['OWNER']), deleteCompanyMember);

// Dashboard Statistics & Task Status Routes
router.get('/:id/dashboard', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']), getDashboardStats);
router.put('/:id/tasks/:taskId/status', auth, authorizeMember(['OWNER', 'ADMIN', 'EDITOR']), updateTaskStatus);

export default router;
