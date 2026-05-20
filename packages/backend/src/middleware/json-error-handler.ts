import { Request, Response, NextFunction } from 'express';

export const jsonErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      error: {
        message: 'The data you submitted contains invalid formatting. Please check your input and try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
  next(err);
};