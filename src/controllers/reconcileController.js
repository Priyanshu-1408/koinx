import path from 'path';
import ReconciliationRun from '../models/ReconciliationRun.js';
import { ingestTransactions } from '../services/ingestionService.js';
import { runMatching } from '../services/matchingService.js';
import { generateReport } from '../services/reportService.js';
import logger from '../utils/logger.js';

export const startReconciliation = async (req, res) => {
  try {
    const { timestampToleranceSecs, quantityTolerancePct } = req.body || {};

    // Validate inputs if provided
    if (timestampToleranceSecs !== undefined && typeof timestampToleranceSecs !== 'number') {
      return res.status(400).json({ error: 'timestampToleranceSecs must be a number' });
    }
    if (quantityTolerancePct !== undefined && typeof quantityTolerancePct !== 'number') {
      return res.status(400).json({ error: 'quantityTolerancePct must be a number' });
    }

    const runConfig = {};
    if (timestampToleranceSecs !== undefined) runConfig.timestampToleranceSecs = timestampToleranceSecs;
    if (quantityTolerancePct !== undefined) runConfig.quantityTolerancePct = quantityTolerancePct;

    const run = new ReconciliationRun({
      status: 'running',
      config: runConfig
    });

    await run.save();
    const runId = run.runId;

    // Immediately return accepted
    res.status(202).json({ runId, status: 'running' });

    // Background process to handle ingestion, matching, and reporting
    (async () => {
      try {
        const userCsvPath = path.resolve(process.cwd(), 'data/user_transactions.csv');
        const exchangeCsvPath = path.resolve(process.cwd(), 'data/exchange_transactions.csv');

        // 1. Ingestion complete with duplicate flags
        await ingestTransactions(runId, userCsvPath, exchangeCsvPath);

        // 2. Perform intelligent matching logic
        const matchResults = await runMatching(runId);

        // 3. Dump results into database and save CSV
        await generateReport(runId, matchResults);

      } catch (err) {
        logger.error(`Error during reconciliation run ${runId}`, { error: err.message, stack: err.stack });
        await ReconciliationRun.findOneAndUpdate({ runId }, { status: 'failed', completedAt: new Date() });
      }
    })();

  } catch (error) {
    logger.error('Error initiating reconciliation', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
