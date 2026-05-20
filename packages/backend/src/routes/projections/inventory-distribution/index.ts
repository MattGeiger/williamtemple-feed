import { Router } from 'express';
import { NextFunction, Request, Response } from 'express';
import { InventoryAggregator } from '../../../services/dashboard';

const router = Router();

/**
 * GET /api/projections/inventory-distribution
 * Returns comprehensive inventory status distribution and analysis
 * 
 * Query Parameters:
 * - timeRange?: string ('1d', '7d', '30d', '365d', 'all-time')
 */
router.get('/inventory-distribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timeRange } = req.query;
    
    const aggregator = new InventoryAggregator();
    const result = await aggregator.getInventoryDistribution(timeRange as string);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projections/inventory-alerts
 * Returns inventory alerts based on stock levels and thresholds
 * 
 * Query Parameters:
 * - timeRange?: string ('1d', '7d', '30d', '365d', 'all-time')
 */
router.get('/inventory-alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timeRange } = req.query;
    
    const aggregator = new InventoryAggregator();
    const result = await aggregator.getInventoryAlerts(timeRange as string);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
