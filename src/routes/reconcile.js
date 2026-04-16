import express from 'express';
import { startReconciliation } from '../controllers/reconcileController.js';

const router = express.Router();

router.post('/', startReconciliation);

export default router;
