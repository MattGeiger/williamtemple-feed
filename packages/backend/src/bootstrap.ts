import dotenv from 'dotenv';

// Load environment variables before any other imports
dotenv.config();

// Log environment state
console.log('Environment initialized:', {
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ENABLED: process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD ? 'yes' : 'no',
  FORCE_AUTH: process.env.FORCE_AUTH === 'true' ? 'yes' : 'no',
  STORAGE_PATH: process.env.STORAGE_PATH || './storage'
});
