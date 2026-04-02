/**
 * errorHandler.js
 *
 * Central Express error-handling middleware.
 * Handles:
 *  - ApiError (our structured errors)
 *  - express-rate-limit 429 errors
 *  - OpenAI API errors  (status, code, type from the openai SDK)
 *  - express-validator ValidationError objects
 *  - Generic unhandled errors
 *
 * Note: Never leaks stack traces in production.
 */

const { ApiError } = require('../utils/ApiError');
const { getMessage } = require('../utils/translator');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    const isDev = process.env.NODE_ENV !== 'production';

    // ── express-rate-limit passes a status of 429 ──────────────────────────
    if (err.statusCode === 429 || err.status === 429) {
        return res.status(429).json({
            error:   'Rate limit exceeded',
            message: err.message || 'Too many requests. Please slow down.',
        });
    }

    // ── Our own structured errors ───────────────────────────────────────────
    if (err instanceof ApiError) {
        const payload = { error: err.message };
        if (err.details) payload.details = err.details;
        if (isDev && err.stack) payload.stack = err.stack;
        return res.status(err.statusCode).json(payload);
    }

    // ── OpenAI SDK errors ───────────────────────────────────────────────────
    // openai@>=4 throws objects with { status, code, type, message }
    if (err.status && err.type && String(err.type).startsWith('invalid')) {
        return res.status(400).json({
            error:   'Invalid request to AI service',
            message: isDev ? err.message : getMessage('ai_invalid_request_generic', req.language),
        });
    }
    if (err.status === 401 && err.type) {
        return res.status(503).json({
            error: 'AI service authentication error',
            message: getMessage('ai_temp_unavailable', req.language),
        });
    }
    if (err.status === 429 && err.type) {
        return res.status(503).json({
            error:   'AI service rate limit',
            message: getMessage('ai_busy_try_again', req.language),
            retryAfterMs: 10_000,
        });
    }
    if (err.status >= 500 && err.type) {
        return res.status(503).json({
            error:   'AI service unavailable',
            message: getMessage('ai_error_try_later', req.language),
        });
    }

    // ── Multer errors (file upload) ─────────────────────────────────────────
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5 MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected file field.' });
    }

    // ── MongoDB / Mongoose errors ───────────────────────────────────────────
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors || {}).map(e => ({
            field: e.path, message: e.message,
        }));
        return res.status(422).json({ error: 'Database validation failed', details });
    }
    if (err.code === 11000) {
        return res.status(409).json({ error: 'Duplicate entry', details: err.keyValue });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ error: `Invalid value for field: ${err.path}` });
    }

    // ── JWT errors ──────────────────────────────────────────────────────────
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: getMessage('invalid_token', req.language) });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: getMessage('token_expired', req.language) });
    }

    // ── Fallback: generic 500 ──────────────────────────────────────────────
    const statusCode = err.statusCode || err.status || 500;
    const message    = isDev ? (err.message || 'Internal Server Error') : 'Internal Server Error';

    // Always log unexpected 500s with full stack for debugging
    if (statusCode >= 500) {
      console.error('[500 Error]', err.message, '\n', err.stack || err);
    }

    const payload = { error: message };
    if (isDev && err.stack) payload.stack = err.stack;

    return res.status(statusCode).json(payload);
}

module.exports = { errorHandler };
