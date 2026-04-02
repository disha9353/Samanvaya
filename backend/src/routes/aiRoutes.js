const express = require('express');
const multer  = require('multer');

const { authenticate }  = require('../middlewares/auth');
const { asyncHandler }  = require('../utils/asyncHandler');
const aiController      = require('../controllers/aiController');

const {
    chatLimiter,
    classifyLimiter,
    barterLimiter,
    translateLimiter,
    generalLimiter,
} = require('../middlewares/aiRateLimiter');

const {
    chatValidation,
    translateValidation,
    quickRepliesValidation,
    detectSpamValidation,
} = require('../utils/aiValidator');

const router = express.Router();

// ── Multer for image upload ───────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 },          // 5 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
        }
    },
});

// ── Authentication applied to every AI route ─────────────────────────────────
router.use(authenticate);

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
// Rate limit: 20 / min per user | Validation: message, language, history
router.post('/chat',
    chatLimiter,
    chatValidation,
    asyncHandler(aiController.chat),
);

// ── POST /api/ai/clear-session ───────────────────────────────────────────────
router.post('/clear-session',
    asyncHandler(aiController.clearSession),
);

// ── POST /api/ai/barter-suggestions ──────────────────────────────────────────
router.post('/barter-suggestions',
    barterLimiter,
    asyncHandler(aiController.barterSuggestions),
);

// ── POST /api/ai/classify-waste ───────────────────────────────────────────────
// Rate limit: 5 / min per user (vision API is expensive)
router.post('/classify-waste',
    classifyLimiter,
    upload.single('image'),
    asyncHandler(aiController.classifyWaste),
);

// ── POST /api/ai/quick-replies ────────────────────────────────────────────────
router.post('/quick-replies',
    generalLimiter,
    quickRepliesValidation,
    asyncHandler(aiController.quickReplies),
);

// ── POST /api/ai/detect-spam ──────────────────────────────────────────────────
router.post('/detect-spam',
    generalLimiter,
    detectSpamValidation,
    asyncHandler(aiController.detectSpamMessage),
);

// ── POST /api/ai/translate ────────────────────────────────────────────────────
// Rate limit: 30 / min per user
router.post('/translate',
    translateLimiter,
    translateValidation,
    asyncHandler(aiController.translate),
);

// ── POST /api/ai/analyze-eco ──────────────────────────────────────────────────
router.post('/analyze-eco',
    generalLimiter,
    asyncHandler(aiController.analyzeEco),
);

// ── GET /api/ai/cache-stats ───────────────────────────────────────────────────
// Diagnostic endpoint — shows cache hit/miss rates (dev/admin only)
router.get('/cache-stats', asyncHandler(async (_req, res) => {
    const { aiCache } = require('../utils/aiCache');
    res.json({ cache: aiCache.stats() });
}));

module.exports = router;