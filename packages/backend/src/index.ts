// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

// Load environment before any other imports
import './bootstrap';

// Force sync of configuration
import './services/sync';

// Initialize the storage service first
import { storageService } from './services/storage';

import createServer from './server';
import './services/translation-trigger';
import { startDataImportStagingSweeper } from './services/data-import/staging-sweeper';

const initializeServices = async () => {
  try {
    await storageService.initialize();
    console.log('Storage service initialized');

    // Expired staged import bytes are PII and must not outlive their documented
    // 24-hour window. The sweep runs once now — collecting anything a previous
    // process left behind — and hourly thereafter. See ISSUES.md #69.
    startDataImportStagingSweeper();
    console.log('Data import staging sweeper started');
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
