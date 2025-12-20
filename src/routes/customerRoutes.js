const express = require('express');
const authMiddleware = require('../middleware/auth');
const customerController = require('../controllers/customerController');

const router = express.Router();

router.use(authMiddleware);
router.get('/', customerController.listCustomers);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
