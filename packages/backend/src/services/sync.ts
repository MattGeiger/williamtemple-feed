import '../bootstrap';
import { TOKEN_RATES, TOKEN_LIMITS, MODEL_NAME } from '../config/limits';

// Force early initialization of limits and rates
// Uncomment for debugging
// console.log('Syncing configuration...', {
//   model: MODEL_NAME,
//   rates: TOKEN_RATES[MODEL_NAME],
//   limits: TOKEN_LIMITS.MODEL_DAILY_LIMITS[MODEL_NAME]
// });
