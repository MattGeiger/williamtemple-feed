// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Type guard for Prisma errors
 */
const isPrismaError = (error: any): error is Prisma.PrismaClientKnownRequestError => {
  return error && 
    error instanceof Error && 
    error.name === 'PrismaClientKnownRequestError' && 
    'code' in error;
};

/**
 * Environment-aware error logging
 */
const logError = (message: string, details?: unknown) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[Error] ${message}`, details);
  }
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Basic error info for logging
  const errorInfo = {
    name: err.name,
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method
  };

  // Log error in development
  logError('Request failed', errorInfo);

  // Format timestamp
  const timestamp = new Date().toISOString();

  // Handle Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          message: 'Please upload a smaller file. The maximum size allowed is 5MB.',
          timestamp,
          code: 'LIMIT_FILE_SIZE'
        }
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: {
          message: 'Please select a valid file type for upload.',
          timestamp,
          code: 'LIMIT_UNEXPECTED_FILE'
        }
      });
    }
  }

  // Handle Prisma errors
  if (isPrismaError(err)) {
    if (err.code === 'P2002') {
      // Extract the field name from the error meta if available
      const target = err.meta?.target as string[] || [];
      const fieldName = target[0] || 'name';
      
      return res.status(400).json({
        error: {
          message: `An item with this ${fieldName} already exists. Please choose a different ${fieldName}.`,
          timestamp,
          code: err.code
        }
      });
    }
    
    if (err.code === 'P2003') {
      return res.status(400).json({
        error: {
          message: 'Cannot delete this item because it is referenced by other items.',
          timestamp,
          code: err.code
        }
      });
    }
    
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          message: 'The requested item could not be found. It may have been deleted or moved.',
          timestamp,
          code: err.code
        }
      });
    }
  }

  // Set status code and format response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Only messages the application deliberately wrote for a user are safe to
  // send to the browser. An error that reaches here without an explicit
  // statusCode is an internal failure -- a Prisma validation error, a
  // TypeError, a driver fault -- and its message is a developer artifact that
  // can carry absolute server paths, query structure, and schema details.
  // Those are unhelpful to staff and should not leave the server, so they are
  // logged and replaced rather than forwarded.
  const carriesUserFacingMessage =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500;

  let friendlyMessage = carriesUserFacingMessage
    ? message
    : 'FEED could not complete that request. Please try again, and let Matt know if it keeps happening.';

  if (!carriesUserFacingMessage) {
    console.error('[Error] Internal failure withheld from client', {
      ...errorInfo,
      stack: err.stack,
    });
  }

  // Status-code defaults for errors whose message is a bare HTTP phrase.
  // A 500 needs no branch here: the withheld-message default above already
  // covers it, and pointing pantry staff at a source repository is not a next
  // step they can act on.
  if (statusCode === 404 && (!err.message || err.message === 'Not Found')) {
    friendlyMessage = 'The requested resource could not be found. It may have been moved or deleted.';
  } else if (statusCode === 401 && (!err.message || err.message === 'Unauthorized')) {
    friendlyMessage = 'Please log in to access this feature.';
  } else if (statusCode === 403 && (!err.message || err.message === 'Forbidden')) {
    friendlyMessage = 'You don\'t have permission to access this resource.';
  } else if (statusCode === 400 && (!err.message || err.message === 'Bad Request')) {
    friendlyMessage = 'There was a problem with your request. Please check your input and try again.';
  } else if (statusCode === 429 && (!err.message || err.message === 'Too Many Requests')) {
    friendlyMessage = 'You\'ve made too many requests. Please wait a minute and try again.';
  }
  
  // Format error response
  res.status(statusCode).json({
    error: {
      message: friendlyMessage,
      timestamp,
      code: err.code || 'INTERNAL_ERROR'
    }
  });
};