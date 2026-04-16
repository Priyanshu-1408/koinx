import express from 'express';
import { 
  getReportEntries, 
  getReportSummary, 
  getUnmatched 
} from '../controllers/reportController.js';

const router = express.Router();

// Order matters: specific routes first
router.get('/:runId/summary', getReportSummary);
router.get('/:runId/unmatched', getUnmatched);
router.get('/:runId', getReportEntries);

export default router;
