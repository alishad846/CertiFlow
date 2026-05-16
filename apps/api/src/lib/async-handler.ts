import type { NextFunction, Request, Response, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
