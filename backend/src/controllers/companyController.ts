// src/controllers/companyController.ts

import { Request, Response } from 'express';
import { prisma } from '../server';
import { sendEmail, isEmailConfigured } from '../services/emailService';
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

    if (gstNumber) {
      const existingGst = await prisma.company.findUnique({
        where: { gstNumber: gstNumber.trim().toUpperCase() }
      });
      if (existingGst) {
        return res.status(400).json({ error: 'A company with this GST number already exists' });
      }
    }

    const company = await companyService.registerCompany(userId, {
      companyName: companyName.trim(),
      state: state.trim(),
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : null,
      pan: pan ? pan.trim().toUpperCase() : null
    });

    res.status(201).json({
      success: true,
      company: { ...company, userRole: 'OWNER' }
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

    const targetUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found. They must create an account first.' });
    }

    const company = await prisma.company.findUnique({ where: { id: req.params.id } });

    const existingMember = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: targetUser.id, companyId: req.params.id } }
    });
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this workspace.' });
    }

    const newMember = await companyService.addWorkspaceMember(req.params.id, targetUser.id, role);

    if (isEmailConfigured) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Welcome to the Team!</h2>
          <p>Hello <strong>${targetUser.fullName}</strong>,</p>
          <p>You have been invited to join the workspace <strong>${company?.companyName}</strong> on ComplianceBot with the role of <strong>${role || 'VIEWER'}</strong>.</p>
          <br/>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
        </div>
      `;

      sendEmail({
        to: targetUser.email,
        subject: `Invitation: Join ${company?.companyName} on ComplianceBot`,
        html: emailHtml,
      }).catch(err => console.error('Email notification failed:', err));
    }

    res.json({ success: true, member: newMember, message: 'Team member added successfully.' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
};

export const deleteCompanyMember = async (req: Request, res: Response) => {
  try {
    const { id: companyId, userId } = req.params;

    const member = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId } }
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found in this workspace' });
    }

    if (member.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot remove the primary workspace owner' });
    }

    await companyService.removeWorkspaceMember(member.id);
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
    const task = await (prisma as any).complianceTask.update({
      where: { id: req.params.taskId },
      data: { status }
    });
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
};
