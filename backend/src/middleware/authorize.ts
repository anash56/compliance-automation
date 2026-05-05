import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';

type Role = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

/**
 * Middleware factory to authorize a user based on their membership and role in a company.
 * @param requiredRoles - An array of roles that are allowed to access the route.
 */
export const authorizeMember = (requiredRoles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // The companyId can be in the request parameters, body, or query string.
      const companyId = req.params.id || req.params.companyId || req.body.companyId;
      const userId = (req as any).userId;

      if (!companyId) {
        console.error('Authorization Error: `authorizeMember` middleware was used on a route that does not provide a `companyId`.');
        return res.status(500).json({ error: 'Server configuration error.' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      const membership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'You are not an active member of this workspace.' });
      }

      if (!requiredRoles.includes(membership.role as Role)) {
        return res.status(403).json({ error: `You do not have permission to perform this action. Required role: ${requiredRoles.join(' or ')}.` });
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);
      res.status(500).json({ error: 'Authorization failed.' });
    }
  };
};