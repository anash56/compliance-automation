// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('Unhandled Application Error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : 'An unexpected internal server error occurred';

  res.status(statusCode).json({
    error: 'Server Error',
    message
  });
};
