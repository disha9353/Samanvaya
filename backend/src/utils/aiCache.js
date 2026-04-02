/**
 * aiCache.js
 *
 * In-memory response cache for deterministic AI calls.
 *
 * Strategy
 * --------
 * - Uses a Map as an LRU-ish store (Map preserves insertion order).
 * - Each entry has a TTL; stale entries are lazily evicted on read.
 * - A periodic sweep removes entries that have expired.
 * - Max size cap prevents unbounded memory growth.
 *
 * What gets cached
 * ----------------
 * - chatWithAI responses (TTL 5 min, keyed on message + language)
 *   NOTE: User-personalised context (ecoScore, items) is intentionally
 *   excluded from the key, so the cache only kicks in for generic queries.
 * - translateMessage responses (TTL 30 min — translations are stable)
 * - suggestQuickReplies (TTL 2 min)
 *
 * NOT cached
 * ----------
 * - classifyWasteFromImage  — always unique inputs
 * - parsePickupRequest      — side-effectful
 * - detectSpam              — should always run fresh
 * - analyzeEcoActivities    — personalised, changes frequently
 */

const DEFAULTS = {
    chat:       5  * 60 * 1000,  // 5 minutes
    translate:  30 * 60 * 1000,  // 30 minutes
    quickReply: 2  * 60 * 1000,  // 2 minutes
};

const MAX_ENTRIES = 500;          // hard cap
const SWEEP_INTERVAL_MS = 60_000; // clean expired entries every minute

class AiCache {
    constructor() {
        /** @type {Map<string, { value: any, expiresAt: number }>} */
        this._store = new Map();
        this._hits  = 0;
        this._misses = 0;

        // Periodic sweep so the map doesn't grow stale
        this._sweepTimer = setInterval(() => this._sweep(), SWEEP_INTERVAL_MS);
        // Don't block process exit
        this._sweepTimer.unref?.();
    }

    // ── Public API ─────────────────────────────────────────────────────────

    /**
     * Build a deterministic cache key.
     * @param {string} namespace   e.g. 'chat', 'translate'
     * @param {...any}  parts      Strings or objects to hash into the key.
     * @returns {string}
     */
    key(namespace, ...parts) {
        const body = parts.map(p =>
            typeof p === 'string' ? p : JSON.stringify(p)
        ).join('|');
        return `${namespace}:${body}`;
    }

    /**
     * Retrieve a cached value, or undefined if missing / expired.
     * @param {string} key
     * @returns {any|undefined}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) { this._misses++; return undefined; }

        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            this._misses++;
            return undefined;
        }

        // LRU: move to end so it survives the next eviction cycle
        this._store.delete(key);
        this._store.set(key, entry);

        this._hits++;
        return entry.value;
    }

    /**
     * Store a value with a TTL.
     * @param {string} key
     * @param {any}    value
     * @param {number} [ttlMs]  Time-to-live in ms. Defaults to 5 minutes.
     */
    set(key, value, ttlMs = DEFAULTS.chat) {
        // Evict oldest entries when cap is reached
        if (this._store.size >= MAX_ENTRIES) {
            const oldestKey = this._store.keys().next().value;
            this._store.delete(oldestKey);
        }

        this._store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    /**
     * Invalidate a specific key.
     * @param {string} key
     */
    del(key) {
        this._store.delete(key);
    }

    /**
     * Remove all entries whose TTL has elapsed.
     */
    _sweep() {
        const now = Date.now();
        for (const [k, entry] of this._store) {
            if (now > entry.expiresAt) this._store.delete(k);
        }
    }

    /** Diagnostic stats (useful for admin dashboards / health checks). */
    stats() {
        return {
            size:   this._store.size,
            hits:   this._hits,
            misses: this._misses,
            hitRate: this._hits + this._misses > 0
                ? ((this._hits / (this._hits + this._misses)) * 100).toFixed(1) + '%'
                : 'n/a',
        };
    }

    /** Destroy the sweep timer (call on graceful shutdown). */
    destroy() {
        clearInterval(this._sweepTimer);
        this._store.clear();
    }
}

// Singleton — shared across all controller invocations in the same process
const aiCache = new AiCache();

module.exports = { aiCache, DEFAULTS };
