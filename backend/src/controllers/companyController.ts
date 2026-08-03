// src/controllers/companyController.ts

import { Request, Response } from 'express';
import { validateGSTIN, validatePAN } from '../utils/validators';
import * as companyService from '../services/companyService';

export const getCompanies = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const companies = await companyService.getUserCompanies(userId);
    res.json({ success: true, companies });
  } catch (error) {
    console.error('Fetch companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
};

export const createCompany = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { companyName, state, gstNumber, pan } = req.body;

    if (!companyName || !state) {
      return res.status(400).json({ error: 'Company name and state are required' });
    }

    if (gstNumber && !validateGSTIN(gstNumber)) {
      return res.status(400).json({ error: 'Invalid GSTIN format (15 alphanumeric characters)' });
    }

    if (pan && !validatePAN(pan)) {
      return res.status(400).json({ error: 'Invalid PAN format (10 alphanumeric characters)' });
    }

    const result = await companyService.registerCompany(userId, {
      companyName: companyName.trim(),
      state: state.trim(),
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : null,
      pan: pan ? pan.trim().toUpperCase() : null
    });

    if (!result.success || !result.company) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      company: { ...result.company, userRole: 'OWNER' }
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to register company' });
  }
};

export const getCompanyById = async (req: Request, res: Response) => {
  try {
    const company = await companyService.getCompanyWithMembership(req.params.id, (req as any).userId);
    if (!company) {
      return res.status(404).json({ error: 'Company workspace not found' });
    }
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
};

export const updateCompany = async (req: Request, res: Response) => {
  try {
    const { companyName, state, gstNumber, pan } = req.body;

    const updates: any = {};
    if (companyName) updates.companyName = companyName.trim();
    if (state) updates.state = state.trim();

    if (gstNumber !== undefined) {
      if (gstNumber && !validateGSTIN(gstNumber)) {
        return res.status(400).json({ error: 'Invalid GSTIN format' });
      }
      updates.gstNumber = gstNumber ? gstNumber.trim().toUpperCase() : null;
    }

    if (pan !== undefined) {
      if (pan && !validatePAN(pan)) {
        return res.status(400).json({ error: 'Invalid PAN format' });
      }
      updates.pan = pan ? pan.trim().toUpperCase() : null;
    }

    const updatedCompany = await companyService.updateCompanyProfile(req.params.id, updates);
    res.json({ success: true, company: updatedCompany, message: 'Workspace updated successfully' });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
};

export const deleteCompany = async (req: Request, res: Response) => {
  try {
    await companyService.removeCompanyWorkspace(req.params.id);
    res.json({ success: true, message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
};

export const getCompanyMembers = async (req: Request, res: Response) => {
  try {
    const members = await companyService.getWorkspaceMembers(req.params.id);
    res.json({ success: true, members });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};

export const addCompanyMember = async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;

    const result = await companyService.inviteWorkspaceMember(req.params.id, email, role);

    if (!result.success) {
      return res.status(result.notFound ? 404 : 400).json({ error: result.error });
    }

    res.json({ success: true, member: result.member, message: 'Team member added successfully.' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
};

export const deleteCompanyMember = async (req: Request, res: Response) => {
  try {
    const { id: companyId, userId } = req.params;

    const result = await companyService.removeWorkspaceMemberByUserId(companyId, userId);

    if (!result.success) {
      return res.status(result.notFound ? 404 : 400).json({ error: result.error });
    }

    res.json({ success: true, message: 'Team member removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove team member' });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const companyId = req.params.id;
    const year = parseInt(req.query.year as string) || (new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1);

    const stats = await companyService.compileDashboardStats(companyId, year);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const task = await companyService.updateTaskStatus(req.params.taskId, status);
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
};
