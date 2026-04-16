import mongoose from 'mongoose';

const rawTransactionSchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    index: true
  },
  source: {
    type: String,
    enum: ['user', 'exchange'],
    required: true
  },
  txId: { type: String },
  timestamp: { type: Date },
  type: { type: String },
  asset: { type: String },
  quantity: { type: Number },
  price: { type: Number },
  fee: { type: Number },
  currency: { type: String },
  rawRow: { type: mongoose.Schema.Types.Mixed },
  dataQualityIssues: [{
    field: String,
    issue: String,
    value: mongoose.Schema.Types.Mixed
  }],
  isFlagged: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const RawTransaction = mongoose.model('RawTransaction', rawTransactionSchema);
export default RawTransaction;
