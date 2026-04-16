import fs from 'fs';
import path from 'path';
import { Parser } from 'json2csv';
import ReportEntry from '../models/Report.js';
import ReconciliationRun from '../models/ReconciliationRun.js';
import logger from '../utils/logger.js';

export const generateReport = async (runId, matchResults) => {
  logger.info(`Generating report for runId: ${runId}`);

  // 1. Format and save all entries to the ReportEntry MongoDB collection
  const reportEntries = matchResults.map(res => ({
    runId,
    category: res.category,
    userTransaction: res.userTx,
    exchangeTransaction: res.exchangeTx,
    reason: res.reason,
    diffFields: res.diffFields || []
  }));

  // Perform a batch insert for speed
  if (reportEntries.length > 0) {
    await ReportEntry.insertMany(reportEntries);
  }

  // 2. Compute the summary exactly matching the schema counts
  const summary = {
    matched: 0,
    conflicting: 0,
    unmatchedUser: 0,
    unmatchedExchange: 0
  };

  for (const res of matchResults) {
    if (res.category === 'matched') summary.matched++;
    else if (res.category === 'conflicting') summary.conflicting++;
    else if (res.category === 'unmatched_user') summary.unmatchedUser++;
    else if (res.category === 'unmatched_exchange') summary.unmatchedExchange++;
  }

  // 3. Update the existing ReconciliationRun status
  await ReconciliationRun.findOneAndUpdate(
    { runId },
    {
      status: 'completed',
      completedAt: new Date(),
      summary
    }
  );

  // 4. Flatten the Data & Generate CSV Report
  const csvData = matchResults.map(res => {
    const uTx = res.userTx || {};
    const eTx = res.exchangeTx || {};
    
    return {
      category: res.category,
      reason: res.reason,
      user_txId: uTx.txId || '',
      user_timestamp: uTx.timestamp ? new Date(uTx.timestamp).toISOString() : '',
      user_type: uTx.type || '',
      user_asset: uTx.asset || '',
      user_quantity: uTx.quantity !== undefined ? uTx.quantity : '',
      user_price: uTx.price !== undefined ? uTx.price : '',
      user_fee: uTx.fee !== undefined ? uTx.fee : '',
      exchange_txId: eTx.txId || '',
      exchange_timestamp: eTx.timestamp ? new Date(eTx.timestamp).toISOString() : '',
      exchange_type: eTx.type || '',
      exchange_asset: eTx.asset || '',
      exchange_quantity: eTx.quantity !== undefined ? eTx.quantity : '',
      exchange_price: eTx.price !== undefined ? eTx.price : '',
      exchange_fee: eTx.fee !== undefined ? eTx.fee : '',
      diffFields: res.diffFields && res.diffFields.length > 0 ? JSON.stringify(res.diffFields) : ''
    };
  });

  const fields = [
    'category', 'reason', 
    'user_txId', 'user_timestamp', 'user_type', 'user_asset', 'user_quantity', 'user_price', 'user_fee',
    'exchange_txId', 'exchange_timestamp', 'exchange_type', 'exchange_asset', 'exchange_quantity', 'exchange_price', 'exchange_fee',
    'diffFields'
  ];
  
  // Safe instantiation utilizing fields so it generates headers even if data is 0 length.
  const json2csvParser = new Parser({ fields });
  const csvContent = csvData.length > 0 ? json2csvParser.parse(csvData) : json2csvParser.parse([]);

  // Ensure root-level /reports directory exists
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const csvPath = path.join(reportsDir, `${runId}.csv`);
  fs.writeFileSync(csvPath, csvContent, 'utf-8');

  logger.info(`Report physically generated and saved to: ${csvPath}`);

  // 5. Output return block
  return { 
    runId, 
    summary, 
    csvPath 
  };
};
