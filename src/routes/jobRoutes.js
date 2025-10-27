const express = require('express');
const authMiddleware = require('../middleware/auth');
const jobController = require('../controllers/jobController');

const router = express.Router();

router.get('/register/:token', jobController.registerFromQr);
router.post('/register/:token', jobController.completeRegistration);

router.use(authMiddleware);
router.get('/', jobController.listJobs);
router.post('/', jobController.createJob);
router.get('/:id', jobController.getJob);
router.put('/:id', jobController.updateJob);
router.delete('/:id', jobController.deleteJob);
router.post('/:id/photos', jobController.uploadPhotos);
router.post('/:id/templates/:templateId/preview', jobController.sendTemplatePreview);

module.exports = router;
