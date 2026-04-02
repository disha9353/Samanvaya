const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../../middlewares/auth');

// Bridge controller from the root directory safely
const oceanController = require('../../controllers/reportController');

// Multer parsing is handled implicitly if using Cloudinary/etc, but we add dest for local dev buffering
const upload = multer({ dest: 'uploads/' });

router.post('/', authenticate, upload.fields([{ name: 'mainMedia', maxCount: 1 }]), oceanController.createReport);
router.get('/nearby', authenticate, oceanController.getNearbyReports);
router.post('/:id/vote', authenticate, oceanController.voteReport);

module.exports = router;
