import { Router } from 'express';

import healthRouter from './health';
import authRouter from './auth';
import customersRouter from './customers';
import devicesRouter from './devices';
import jobsRouter from './jobs';
import aiRouter from './ai';
import campaignsRouter from './campaigns';
import dashboardRouter from './dashboard';
import reportsRouter from './reports';
import settingsRouter from './settings';
import backupsRouter from './backups';

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

export default router;

