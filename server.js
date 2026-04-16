import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './src/config/db.js';
import logger from './src/utils/logger.js';

const PORT = process.env.PORT || 3000;

// Connect to MongoDB Database
connectDB().then(() => {
  // Start Application Server
  app.listen(PORT, () => {
    logger.info(`Server running globally on port ${PORT}`);
  });
});
