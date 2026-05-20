// Load environment before any other imports
import './bootstrap';

// Force sync of configuration
import './services/sync';

// Initialize the storage service first
import { storageService } from './services/storage';

import createServer from './server';
import './services/translation-trigger';

const initializeServices = async () => {
  try {
    await storageService.initialize();
    console.log('Storage service initialized');
    console.log('Shopping list PDF service skipped: legacy implementation removed while PDFMake replacement is in progress');
  } catch (err) {
    console.error('Failed to initialize services:', err);
    process.exit(1);
  }
};

initializeServices();

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';
const app = createServer();

app.listen(port, host, () => {
  console.log(`Backend server running on ${host}:${port}`);
});
