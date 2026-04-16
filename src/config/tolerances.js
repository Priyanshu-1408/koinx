export default {
  timestampToleranceSecs: Number(process.env.TIMESTAMP_TOLERANCE_SECONDS) || 300,
  quantityTolerancePct: Number(process.env.QUANTITY_TOLERANCE_PCT) || 0.01
};
