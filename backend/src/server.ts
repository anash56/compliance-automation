// src/server.ts

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import cookieParser from 'cookie-parser';

// Import routes
import authRoutes from './routes/auth';
import invoiceRoutes from './routes/invoices';
import gstRoutes from './routes/gst';
import tdsRoutes from './routes/tds';
import companyRoutes from './routes/companies';
import { startComplianceCron } from './routes/complianceCron';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Export prisma for use in other files
export const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'OK',
      message: 'Database connected',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      message: 'Database connection failed',
      error: (error as Error).message
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/tds', tdsRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start Background Jobs
startComplianceCron();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`✓ Database: PostgreSQL via Prisma`);
  console.log(`✓ Health check: GET /api/health`);
});

export default app;
