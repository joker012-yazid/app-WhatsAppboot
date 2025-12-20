import { Router } from 'express';

import healthRouter from './health.routes';
import authRouter from './auth.routes';
import customersRouter from './customers.routes';
import devicesRouter from './devices.routes';
import jobsRouter from './jobs.routes';
import aiRouter from './ai.routes';
import campaignsRouter from './campaigns.routes';
import dashboardRouter from './dashboard.routes';
import reportsRouter from './reports.routes';
import settingsRouter from './settings.routes';
import backupsRouter from './backups.routes';
import whatsappRouter from './whatsapp.routes';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/customers', customersRouter);
router.use('/devices', devicesRouter);
router.use('/jobs', jobsRouter);
router.use('/ai', aiRouter);
router.use('/campaigns', campaignsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportsRouter);
router.use('/settings', settingsRouter);
router.use('/backups', backupsRouter);
router.use('/whatsapp', whatsappRouter);

export default router;

