import mongoose from 'mongoose';

const reportEntrySchema = new mongoose.Schema({
  runId: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['matched', 'conflicting', 'unmatched_user', 'unmatched_exchange'],
    required: true
  },
  userTransaction: { type: mongoose.Schema.Types.Mixed },
  exchangeTransaction: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String },
  diffFields: [{
    field: String,
    userValue: mongoose.Schema.Types.Mixed,
    exchangeValue: mongoose.Schema.Types.Mixed
  }]
}, { timestamps: true });

const ReportEntry = mongoose.model('ReportEntry', reportEntrySchema);
export default ReportEntry;
