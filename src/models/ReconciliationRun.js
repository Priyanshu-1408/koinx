import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const reconciliationRunSchema = new mongoose.Schema({
  runId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  config: {
    timestampToleranceSecs: { type: Number, default: 0 },
    quantityTolerancePct: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  summary: {
    matched: { type: Number, default: 0 },
    conflicting: { type: Number, default: 0 },
    unmatchedUser: { type: Number, default: 0 },
    unmatchedExchange: { type: Number, default: 0 }
  }
});

const ReconciliationRun = mongoose.model('ReconciliationRun', reconciliationRunSchema);
export default ReconciliationRun;
