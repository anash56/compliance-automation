// src/routes/companies.ts

import express, { Router, Request, Response } from 'express';
import { prisma } from '../server';
import auth from '../middleware/auth';

const router: Router = express.Router();

// Create company
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { gstNumber, companyName, state, pan, employeesCount, businessType } = req.body;

    if (!companyName || !state) {
      return res.status(400).json({ error: 'Company name and state are required' });
    }

    const company = await prisma.company.create({
      data: {
        userId: req.userId!,
        gstNumber,
        companyName,
        state,
        pan,
        employeesCount,
        businessType
      }
    });

    res.status(201).json({
      success: true,
      company
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'GST number already exists' });
    }
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Get all companies for user
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      where: { userId: req.userId },
      include: {
        _count: {
          select: {
            invoices: true,
            gstReturns: true,
            tdsRecords: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      companies
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get single company
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            invoices: true,
            gstReturns: true,
            tdsRecords: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (company.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      company
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Update company
router.put('/:id', auth, async (req: Request, res: Response) => {
  try {
    const { gstNumber, companyName, state, pan, employeesCount, businessType } = req.body;

    const company = await prisma.company.findUnique({
      where: { id: req.params.id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (company.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: req.params.id },
      data: {
        gstNumber,
        companyName,
        state,
        pan,
        employeesCount,
        businessType
      }
    });

    res.json({
      success: true,
      company: updatedCompany
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'GST number already exists' });
    }
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

export default router;