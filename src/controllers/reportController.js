import ReportEntry from '../models/Report.js';
import ReconciliationRun from '../models/ReconciliationRun.js';
import logger from '../utils/logger.js';

export const getReportEntries = async (req, res) => {
  try {
    const { runId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    if (page < 1 || limit < 1) {
      return res.status(400).json({ error: 'Page and limit must be positive integers' });
    }

    const skip = (page - 1) * limit;

    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      return res.status(404).json({ error: 'Run ID not found' });
    }

    const entries = await ReportEntry.find({ runId }).skip(skip).limit(limit);
    const total = await ReportEntry.countDocuments({ runId });

    res.status(200).json({ 
      data: entries, 
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      } 
    });
  } catch (error) {
    logger.error('Error in getReportEntries', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getReportSummary = async (req, res) => {
  try {
    const { runId } = req.params;
    
    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      return res.status(404).json({ error: 'Run ID not found' });
    }

    const { summary, status } = run.toJSON();
    res.status(200).json({ status, ...summary });
  } catch (error) {
    logger.error('Error in getReportSummary', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getUnmatched = async (req, res) => {
  try {
    const { runId } = req.params;

    const run = await ReconciliationRun.findOne({ runId });
    if (!run) {
      return res.status(404).json({ error: 'Run ID not found' });
    }

    // Isolate only the unmatched instances and strictly select the required outputs
    const entries = await ReportEntry.find({ 
      runId, 
      category: { $in: ['unmatched_user', 'unmatched_exchange'] } 
    }).select('category reason userTransaction exchangeTransaction diffFields -_id'); // Excluding mongodb internal _id 

    res.status(200).json({ data: entries });
  } catch (error) {
    logger.error('Error in getUnmatched', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
