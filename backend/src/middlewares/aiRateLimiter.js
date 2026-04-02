/**
 * aiRateLimiter.js
 *
 * Purpose-built rate limiters for each AI endpoint.
 * Uses express-rate-limit (already installed) with per-user keying
 * so authenticated users have independent windows.
 *
 * Limits (per user, sliding window):
 *  - chatLimiter       : 30 requests / minute  (1 Gemini call each — safe under 15 RPM free tier)
 *  - classifyLimiter   :  5 requests / minute  (vision is expensive)
 *  - barterLimiter     : 10 requests / minute
 *  - translateLimiter  : 30 requests / minute
 *  - generalLimiter    : 60 requests / minute  (catch-all)
 */

const rateLimit = require('express-rate-limit');

// express-rate-limit v8 exports ipKeyGenerator to handle IPv6 addresses safely
// when a custom keyGenerator falls back to req.ip.
const { ipKeyGenerator } = rateLimit;

/**
 * Returns a human-readable "try again in X seconds" message.
 */
function retryMessage(windowMs) {
    const seconds = Math.ceil(windowMs / 1000);
    return `Too many requests. Please wait ${seconds} seconds before trying again.`;
}

/**
 * Creates a rate limiter keyed on authenticated user ID.
 * Falls back to the library's ipKeyGenerator (IPv6-safe) when req.user
 * is not available (e.g. unauthenticated pre-flight requests).
 */
function makeUserLimiter({ max, windowMs, name }) {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders:   false,

        keyGenerator: (req) => {
            if (req.user?._id) return req.user._id.toString();
            return ipKeyGenerator(req);
        },

        handler: (_req, res) => {
            const retryAfterSec = Math.ceil(windowMs / 1000);
            res.set('Retry-After', String(retryAfterSec));
            res.status(429).json({
                error:          'Rate limit exceeded',
                endpoint:       name,
                message:        retryMessage(windowMs),
                retryAfterMs:   windowMs,
                retryAfterSec,
            });
        },

        skip: () => process.env.NODE_ENV === 'test',
    });
}

// ── Individual limiters ──────────────────────────────────────────────────────

/** 30 chat messages per user per minute (1 Gemini call each = safe under 15 RPM free tier) */
const chatLimiter = makeUserLimiter({
    name:     'ai/chat',
    max:      30,
    windowMs: 60 * 1000,
});

/** 5 waste-image classifications per user per minute (vision API is costly) */
const classifyLimiter = makeUserLimiter({
    name:     'ai/classify-waste',
    max:      5,
    windowMs: 60 * 1000,
});

/** 10 barter-suggestion requests per user per minute */
const barterLimiter = makeUserLimiter({
    name:     'ai/barter-suggestions',
    max:      10,
    windowMs: 60 * 1000,
});

/** 30 translation requests per user per minute */
const translateLimiter = makeUserLimiter({
    name:     'ai/translate',
    max:      30,
    windowMs: 60 * 1000,
});

/** 60 requests per user per minute for cheap utility endpoints */
const generalLimiter = makeUserLimiter({
    name:     'ai/general',
    max:      60,
    windowMs: 60 * 1000,
});

module.exports = {
    chatLimiter,
    classifyLimiter,
    barterLimiter,
    translateLimiter,
    generalLimiter,
};
