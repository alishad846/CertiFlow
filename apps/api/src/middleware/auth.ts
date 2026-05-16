import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { pool } from '../db/pool';
import { AppError } from '../lib/errors';
import type { CompanyPermissions, CompanyStatus, UserRole } from '@certiflow/shared';

export interface AuthUser {
  id: string;
  companyId: string | null;
  role: UserRole;
  email: string;
  name: string;
  tokenVersion?: number;
  companyStatus?: CompanyStatus | null;
  permissions?: CompanyPermissions;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getToken(req: Request) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  return req.cookies?.token ?? bearer;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getToken(req);
    if (!token) {
      throw new AppError('Not authenticated', 401);
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      companyId: string | null;
      role: UserRole;
      email: string;
      name: string;
      tokenVersion?: number;
    };

    const dbUser = await pool.query<{
      id: string;
      company_id: string | null;
      role: UserRole;
      email: string;
      name: string;
      token_version: number;
      company_status: CompanyStatus | null;
      can_create_batches: boolean | null;
      can_request_upi: boolean | null;
      can_view_reports: boolean | null;
    }>(
      `SELECT u.id, u.company_id, u.role, u.email, u.name, u.token_version,
              c.status AS company_status, c.can_create_batches, c.can_request_upi, c.can_view_reports
       FROM users u
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [payload.sub]
    );
    const user = dbUser.rows[0];
    if (!user) {
      throw new AppError('Not authenticated', 401);
    }

    if (user.role === 'company_admin') {
      if (!user.company_id || user.company_status !== 'active') {
        throw new AppError('Company access is blocked', 403);
      }

      if (payload.tokenVersion !== user.token_version) {
        throw new AppError('Session expired', 401);
      }
    }

    req.user = {
      id: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
      name: user.name,
      tokenVersion: user.token_version,
      companyStatus: user.company_status,
      permissions: {
        canCreateBatches: user.can_create_batches ?? true,
        canRequestUpi: user.can_request_upi ?? true,
        canViewReports: user.can_view_reports ?? true
      }
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Not authenticated', 401));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError('Forbidden', 403));
      return;
    }
    next();
  };
}

export async function loadUserFromDb(userId: string) {
  const result = await pool.query<{
    id: string;
    company_id: string | null;
    role: UserRole;
    email: string;
    name: string;
  }>('SELECT id, company_id, role, email, name FROM users WHERE id = $1', [userId]);
  return result.rows[0] ?? null;
}
