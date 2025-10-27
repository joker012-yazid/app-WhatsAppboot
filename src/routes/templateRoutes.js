const express = require('express');
const authMiddleware = require('../middleware/auth');
const templateService = require('../services/templateService');

const router = express.Router();

router.use(authMiddleware);
router.get('/', (req, res) => {
  res.json(templateService.listTemplates());
});

router.post('/', (req, res) => {
  const { name, category, body } = req.body;
  if (!name || !body) {
    return res.status(400).json({ message: 'name and body are required' });
  }

  try {
    const template = templateService.createTemplate({ name, category, body });
    res.status(201).json(template);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Template name must be unique' });
    }
    throw error;
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, body } = req.body;
  if (!name || !body) {
    return res.status(400).json({ message: 'name and body are required' });
  }
  const updated = templateService.updateTemplate(id, { name, category, body });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  templateService.deleteTemplate(id);
  res.status(204).send();
});

module.exports = router;
