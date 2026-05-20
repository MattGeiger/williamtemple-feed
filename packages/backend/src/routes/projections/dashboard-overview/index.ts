import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import { OverviewAggregator } from '../../../services/dashboard';

const router = Router();

/**
 * GET /api/projections/dashboard-overview
 * Returns comprehensive overview metrics for all dashboard stats cards
 * 
 * Query Parameters:
 * - timeRange?: string ('1d', '7d', '30d', '365d', 'all-time')
 */
router.get('/dashboard-overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timeRange } = req.query;
    
    const aggregator = new OverviewAggregator();
    const result = await aggregator.getOverviewMetrics(timeRange as string);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
