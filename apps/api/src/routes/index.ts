import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import batchRoutes from './batches';
import logsRoutes from './logs';
import billingRoutes from './billing';
import companiesRoutes from './companies';
import certificateTemplatesRoutes from './certificate-templates';
import certificatesRoutes from './certificates';
import subscriptionsRoutes from './subscriptions';
import editorRoutes from './editor';

const router = Router();

router.use('/api/editor', editorRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/batches', batchRoutes);
router.use('/logs', logsRoutes);
router.use('/billing', billingRoutes);
router.use('/companies', companiesRoutes);
router.use('/certificate-templates', certificateTemplatesRoutes);
router.use('/subscription', subscriptionsRoutes);
router.use(certificatesRoutes);

export default router;
