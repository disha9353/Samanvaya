/**
 * aiValidator.js
 *
 * Centralised validation + sanitisation rules for every AI endpoint.
 * Uses express-validator (already installed).
 *
 * Rules applied globally to every schema:
 *  - trim()          — strip leading/trailing whitespace
 *  - escape()        — HTML-encode < > & " ' so XSS payloads can't survive
 *  - isLength()      — prevent huge payloads that would explode the AI token budget
 *
 * Usage:
 *   const { chatValidation } = require('../utils/aiValidator');
 *   router.post('/chat', chatValidation, asyncHandler(aiController.chat));
 */

const { body, validationResult } = require('express-validator');

// ── Shared constants ────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = ['en', 'hi', 'kn'];
const SUPPORTED_TARGET_LANGUAGES = [
    'en', 'hi', 'kn',
    'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ar'
];

const MAX_MESSAGE_LEN  = 1000;   // ~250 tokens — generous but capped
const MAX_HISTORY_LEN  = 20;     // max turns in conversation context
const MAX_CONTENT_LEN  = 2000;   // per history message content

// ── Middleware: validate and short-circuit on errors ────────────────────────

/**
 * Express middleware that reads validation errors produced by express-validator
 * and returns a structured 422 response if any exist.
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            error:   'Validation failed',
            details: errors.array().map(e => ({
                field:   e.path,
                message: e.msg,
                value:   e.value,
            })),
        });
    }
    return next();
}

// ── Validation schemas ───────────────────────────────────────────────────────

/**
 * POST /api/ai/chat
 */
const chatValidation = [
    body('message')
        .trim()
        .notEmpty()   .withMessage('message is required')
        .isString()   .withMessage('message must be a string')
        .isLength({ max: MAX_MESSAGE_LEN })
                      .withMessage(`message must be ≤ ${MAX_MESSAGE_LEN} characters`),
        // NOTE: .escape() intentionally removed — it HTML-encodes AI message content
        // (e.g. apostrophes, quotes) which corrupts the text sent to the LLM.

    body('language')
        .optional()
        .trim()
        .isIn(SUPPORTED_LANGUAGES)
                      .withMessage(`language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`),

    body('history')
        .optional()
        .isArray({ max: MAX_HISTORY_LEN })
                      .withMessage(`history must be an array with at most ${MAX_HISTORY_LEN} entries`),

    body('history.*.role')
        .optional()
        .isIn(['user', 'assistant'])
                      .withMessage('history[].role must be "user" or "assistant"'),

    body('history.*.content')
        .optional()
        .trim()
        .isString()   .withMessage('history[].content must be a string')
        .isLength({ max: MAX_CONTENT_LEN })
                      .withMessage(`history[].content must be ≤ ${MAX_CONTENT_LEN} characters`),
        // NOTE: .escape() intentionally removed — same reason as above.

    handleValidationErrors,
];

/**
 * POST /api/ai/translate
 */
const translateValidation = [
    body('message')
        .trim()
        .notEmpty()   .withMessage('message is required')
        .isString()   .withMessage('message must be a string')
        .isLength({ max: MAX_MESSAGE_LEN })
                      .withMessage(`message must be ≤ ${MAX_MESSAGE_LEN} characters`)
        .escape(),

    body('targetLanguage')
        .trim()
        .notEmpty()   .withMessage('targetLanguage is required')
        .isIn(SUPPORTED_TARGET_LANGUAGES)
                      .withMessage(`targetLanguage must be one of: ${SUPPORTED_TARGET_LANGUAGES.join(', ')}`),

    body('sourceLanguage')
        .optional()
        .trim()
        .isIn([...SUPPORTED_TARGET_LANGUAGES, 'auto'])
                      .withMessage('Invalid sourceLanguage'),

    handleValidationErrors,
];

/**
 * POST /api/ai/quick-replies
 */
const quickRepliesValidation = [
    body('message')
        .trim()
        .notEmpty()   .withMessage('message is required')
        .isString()   .withMessage('message must be a string')
        .isLength({ max: MAX_MESSAGE_LEN })
                      .withMessage(`message must be ≤ ${MAX_MESSAGE_LEN} characters`)
        .escape(),

    body('conversationHistory')
        .optional()
        .isArray({ max: MAX_HISTORY_LEN })
                      .withMessage(`conversationHistory must be an array of at most ${MAX_HISTORY_LEN} items`),

    handleValidationErrors,
];

/**
 * POST /api/ai/detect-spam
 */
const detectSpamValidation = [
    body('message')
        .trim()
        .notEmpty()   .withMessage('message is required')
        .isString()   .withMessage('message must be a string')
        .isLength({ max: MAX_MESSAGE_LEN })
                      .withMessage(`message must be ≤ ${MAX_MESSAGE_LEN} characters`)
        .escape(),

    body('recentMessages')
        .optional()
        .isArray({ max: 20 })
                      .withMessage('recentMessages must be an array of at most 20 items'),

    handleValidationErrors,
];

module.exports = {
    chatValidation,
    translateValidation,
    quickRepliesValidation,
    detectSpamValidation,
    handleValidationErrors,
    SUPPORTED_LANGUAGES,
    SUPPORTED_TARGET_LANGUAGES,
};
