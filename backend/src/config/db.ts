// src/config/db.ts

import { PrismaClient } from '@prisma/client';

/**
 * Centralized PrismaClient instance holding the PostgreSQL Connection Pool.
 */
export const prisma = new PrismaClient();
