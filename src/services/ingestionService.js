import fs from 'fs';
import csvParser from 'csv-parser';
import RawTransaction from '../models/Transaction.js';
import logger from '../utils/logger.js';

/**
 * Parses a CSV file and normalizes/validates the entries.
 */
const parseAndProcessCsv = (filePath, source, runId) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        const issues = [];
        let isFlagged = false;
        
        // Normalize: trim strings
        const normalized = {};
        for (const [key, value] of Object.entries(data)) {
          normalized[key] = typeof value === 'string' ? value.trim() : value;
        }

        // 1. Check missing required fields
        const requiredFields = ['txId', 'timestamp', 'type', 'asset', 'quantity'];
        for (const field of requiredFields) {
          if (!normalized[field] || normalized[field] === '') {
            isFlagged = true;
            issues.push({ field, issue: `Missing required field: ${field}`, value: normalized[field] });
          }
        }

        // 2. Normalize and validate timestamp
        let parsedTimestamp = undefined;
        if (normalized.timestamp) {
          const dateObj = new Date(normalized.timestamp);
          if (isNaN(dateObj.getTime())) {
            isFlagged = true;
            issues.push({ field: 'timestamp', issue: 'Invalid/unparseable timestamp', value: normalized.timestamp });
          } else {
            parsedTimestamp = dateObj;
          }
        }

        // 3. Normalize asset name
        if (normalized.asset) {
          normalized.asset = String(normalized.asset).toUpperCase();
        }

        // 4. Normalize and validate numbers
        const parseFloatField = (field, isStrictPositive = false) => {
          if (normalized[field] !== undefined && normalized[field] !== '') {
            const parsed = parseFloat(normalized[field]);
            if (isNaN(parsed)) {
               if (isStrictPositive) {
                 isFlagged = true;
                 issues.push({ field, issue: `${field} is NaN`, value: normalized[field] });
               }
               return undefined; 
            }
            if (isStrictPositive && parsed < 0) {
               isFlagged = true;
               issues.push({ field, issue: `${field} is negative`, value: parsed });
            }
            return parsed;
          }
          return undefined;
        };

        const quantity = parseFloatField('quantity', true);
        const price = parseFloatField('price', true);
        const fee = parseFloatField('fee', false);

        results.push({
          runId,
          source,
          txId: normalized.txId,
          timestamp: parsedTimestamp, // will be undefined if invalid, avoiding Mongoose CastError
          type: normalized.type,
          asset: normalized.asset,
          quantity: quantity,
          price: price,
          fee: fee,
          currency: normalized.currency,
          rawRow: data, // original unparsed row
          dataQualityIssues: issues,
          isFlagged
        });
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};

/**
 * Checks for duplicate txIds in the array and flags them.
 */
const flagDuplicates = (transactions) => {
  const txIdMap = new Map();
  
  for (const tx of transactions) {
    if (!tx.txId) continue;
    if (txIdMap.has(tx.txId)) {
      txIdMap.get(tx.txId).push(tx);
    } else {
      txIdMap.set(tx.txId, [tx]);
    }
  }

  for (const [txId, txs] of txIdMap.entries()) {
    if (txs.length > 1) {
      for (const tx of txs) {
        tx.isFlagged = true;
        tx.dataQualityIssues.push({
          field: 'txId',
          issue: 'Duplicate txId within same source',
          value: txId
        });
      }
    }
  }
};

/**
 * Main ingestion function.
 */
export const ingestTransactions = async (runId, userCsvPath, exchangeCsvPath) => {
  logger.info(`Starting ingestion for runId: ${runId}`);

  try {
    const userTxs = await parseAndProcessCsv(userCsvPath, 'user', runId);
    const exchangeTxs = await parseAndProcessCsv(exchangeCsvPath, 'exchange', runId);

    // Flag duplicates within the same source before saving
    flagDuplicates(userTxs);
    flagDuplicates(exchangeTxs);

    const allTxs = [...userTxs, ...exchangeTxs];
    
    // Using Mongoose insertMany directly
    const savedDocs = await RawTransaction.insertMany(allTxs);

    const savedIds = savedDocs.map(doc => doc._id);
    const flaggedCount = savedDocs.filter(doc => doc.isFlagged).length;

    logger.info('Ingestion complete. Flagged rows summary:', {
      runId,
      totalParsed: allTxs.length,
      flaggedCount,
      userFlagged: userTxs.filter(t => t.isFlagged).length,
      exchangeFlagged: exchangeTxs.filter(t => t.isFlagged).length
    });

    return {
      totalParsed: allTxs.length,
      flaggedCount,
      savedIds
    };
  } catch (error) {
    logger.error('Error during ingestion', { error: error.message, runId });
    throw error;
  }
};
