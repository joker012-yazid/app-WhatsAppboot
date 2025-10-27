const express = require('express');
const authMiddleware = require('../middleware/auth');
const deviceController = require('../controllers/deviceController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', deviceController.listDevices);
router.post('/', deviceController.createDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);

module.exports = router;
