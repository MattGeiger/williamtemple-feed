// Ensure we import bootstrap first to load environment
import '../bootstrap';

// Define and export all environment variables
const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3001,
  STORAGE_PATH: process.env.STORAGE_PATH || './storage',
} as const;

// Export individual values
export const STORAGE_PATH = ENV.STORAGE_PATH;