import express from 'express';
import reconcileRoutes from './src/routes/reconcile.js';
import reportRoutes from './src/routes/report.js';
import logger from './src/utils/logger.js';

const app = express();

// Middleware
app.use(express.json());

// Mount routes
app.use('/reconcile', reconcileRoutes);
app.use('/report', reportRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error'
  });
});

export default app;
