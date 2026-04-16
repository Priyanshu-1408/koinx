import RawTransaction from '../models/Transaction.js';
import ReconciliationRun from '../models/ReconciliationRun.js';
import logger from '../utils/logger.js';
import { getStandardAsset } from '../utils/assetAliases.js';

const typeMappingMatch = (userType, exchangeType) => {
  if (!userType || !exchangeType) return false;
  
  const nUser = String(userType).toUpperCase().trim();
  const nEx   = String(exchangeType).toUpperCase().trim();
  
  // Exact match
  if (nUser === nEx) return true;
  
  // Specific mappings
  if (nUser === 'TRANSFER_OUT' && nEx === 'TRANSFER_IN') return true;
  
  return false;
};

export const runMatching = async (runId) => {
  logger.info(`Starting matching for runId: ${runId}`);
  
  // Load config
  const runConfig = await ReconciliationRun.findOne({ runId });
  if (!runConfig) {
    throw new Error(`Reconciliation run ${runId} not found`);
  }
  
  const timestampToleranceSecs = runConfig.config.timestampToleranceSecs ?? 300;
  const quantityTolerancePct = runConfig.config.quantityTolerancePct ?? 0.01;

  // 1. Load non-critically flagged RawTransactions
  // "Critically flagged" here implies lack of required fields (timestamp/quantity/asset) needed for any alg matching.
  const allTxs = await RawTransaction.find({ runId });
  
  const validTxs = allTxs.filter(tx => {
    // If it lacks basic fields, it physically cannot participate in valid matches
    if (!tx.timestamp || tx.quantity === undefined || tx.quantity === null || !tx.asset) {
      return false;
    }
    return true;
  });

  const userTxs = validTxs.filter(tx => tx.source === 'user');
  const exchangeTxs = validTxs.filter(tx => tx.source === 'exchange');

  const matchedPairs = []; // array of { userTx, exchangeTx, matchType }
  
  // Step A: Exact txId match
  const remainingUserTxs = [];
  for (const uTx of userTxs) {
    if (uTx.txId) {
      const exIndex = exchangeTxs.findIndex(eTx => eTx.txId === uTx.txId);
      if (exIndex !== -1) {
        matchedPairs.push({ userTx: uTx, exchangeTx: exchangeTxs[exIndex], matchType: 'exact' });
        exchangeTxs.splice(exIndex, 1);
        continue;
      }
    }
    remainingUserTxs.push(uTx);
  }

  // Step B: Proximity match for remaining
  const finalUnmatchedUser = [];
  for (const uTx of remainingUserTxs) {
    const stdUserAsset = getStandardAsset(uTx.asset);
    
    const matchIndex = exchangeTxs.findIndex(eTx => {
       const stdExAsset = getStandardAsset(eTx.asset);
       if (stdUserAsset !== stdExAsset) return false;
       
       if (!typeMappingMatch(uTx.type, eTx.type)) return false;
       
       const timeDiffSecs = Math.abs(uTx.timestamp.getTime() - eTx.timestamp.getTime()) / 1000;
       if (timeDiffSecs > timestampToleranceSecs) return false;
       
       const qtyDiffPct = uTx.quantity === 0 
         ? (eTx.quantity === 0 ? 0 : Infinity)
         : (Math.abs(uTx.quantity - eTx.quantity) / Math.abs(uTx.quantity) * 100);
         
       if (qtyDiffPct > quantityTolerancePct) return false;
       
       return true;
    });

    if (matchIndex !== -1) {
      matchedPairs.push({ userTx: uTx, exchangeTx: exchangeTxs[matchIndex], matchType: 'proximity' });
      exchangeTxs.splice(matchIndex, 1);
    } else {
      finalUnmatchedUser.push(uTx);
    }
  }

  const finalUnmatchedExchange = exchangeTxs;

  // Step 5: For matched pairs, check price/fee differences
  const results = [];
  
  const calcPctDiff = (valA, valB) => {
    if (valA === valB) return 0;
    if (valA === 0) return Infinity; // Prevent div by 0
    return (Math.abs(valA - valB) / Math.abs(valA)) * 100;
  };

  for (const pair of matchedPairs) {
    const { userTx, exchangeTx, matchType } = pair;
    const diffFields = [];
    
    // Check price diff
    if (userTx.price !== undefined && exchangeTx.price !== undefined) {
       const priceDiffPct = calcPctDiff(userTx.price, exchangeTx.price);
       if (priceDiffPct > quantityTolerancePct) {
          diffFields.push({ field: 'price', userValue: userTx.price, exchangeValue: exchangeTx.price });
       }
    } else if (userTx.price !== exchangeTx.price) {
        // One is present, the other is undefined
        diffFields.push({ field: 'price', userValue: userTx.price, exchangeValue: exchangeTx.price });
    }

    // Check fee diff
    if (userTx.fee !== undefined && exchangeTx.fee !== undefined) {
       const feeDiffPct = calcPctDiff(userTx.fee, exchangeTx.fee);
       if (feeDiffPct > quantityTolerancePct) {
          diffFields.push({ field: 'fee', userValue: userTx.fee, exchangeValue: exchangeTx.fee });
       }
    } else if (userTx.fee !== exchangeTx.fee) {
       diffFields.push({ field: 'fee', userValue: userTx.fee, exchangeValue: exchangeTx.fee });
    }

    if (diffFields.length > 0) {
       results.push({
          category: 'conflicting',
          userTx,
          exchangeTx,
          reason: `Matched via '${matchType}', but price/fee exceeded tolerance`,
          diffFields
       });
    } else {
       results.push({
          category: 'matched',
          userTx,
          exchangeTx,
          reason: matchType === 'exact' ? 'Exact txId match' : 'Proximity match',
          diffFields: []
       });
    }
  }

  // Step C & D: Create records for those without matches
  for (const u of finalUnmatchedUser) {
     results.push({
        category: 'unmatched_user',
        userTx: u,
        exchangeTx: null,
        reason: 'No matching transaction found on exchange (Step C)',
        diffFields: []
     });
  }

  for (const e of finalUnmatchedExchange) {
     results.push({
        category: 'unmatched_exchange',
        userTx: null,
        exchangeTx: e,
        reason: 'No matching transaction found on user source (Step D)',
        diffFields: []
     });
  }

  logger.info(`Matching algorithm complete. Generated ${results.length} results.`);
  
  return results;
};
