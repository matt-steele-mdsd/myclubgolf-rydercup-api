"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
// Dedicated database for this app (rydercup) on the same MySQL server phoneAI uses.
// Used to share phoneAI's myclubgolf database directly; now has its own copy of every
// Ryder* table plus a forked Course/CourseDetails (see rydercup-porting-status memory
// for why).
//
// RESOLVED (2026-07-12): the mystery below turned out to be the legacy PHP site
// (myclubgolf.com/ryder/*.php) — it was the original entry point for this whole app
// before RyderCup split off into its own Expo/Express project, and every one of its 18
// files was still connecting to `myclubgolf` and (in a few — savematch.php,
// savematchres.php, savescore.php, leaderboard.php, rydermatch.php, scorecard2.php) had
// `` `myclubgolf`.`RyderMatch` ``-style fully-qualified table names baked directly into
// their SQL. That's what kept writing to myclubgolf's copy independently of this Node
// backend. All 18 files (everything except myclubgolf.php itself, which is unrelated —
// it queries phoneAI's own Player/Game/Score/CourseDetails tables) were repointed at
// `rydercup` on the server directly. The legacy site is expected to stay unused now that
// the app is the real entry point, but is being kept working as a fallback.
//
// Original unresolved note, kept for context: this comment used to claim "phoneAI keeps
// writing to myclubgolf's copy, the two no longer stay in sync" — that's what prompted
// migrating myclubgolf's Ryder* tables to their own production `rydercup` database and
// dropping the myclubgolf originals (after backing them up). A grep of phoneAI's own
// `src/services/*.ts` and `server.ts` found zero references to any Ryder* table, which
// is what made the legacy PHP site the answer. At drop time, myclubgolf.RyderMatch had
// 1202 rows vs. 1230 in this app's own `rydercup` copy (sourced from local dev) — the
// legacy site's independent writes. The dropped myclubgolf tables were backed up to JSON
// first (see phoneAI's `myclubgolf_db_cleanup` memory), so recoverable if ever needed.
//
// Credentials come from env vars (see .env, gitignored) rather than being hardcoded, so
// they never end up committed to this repo.
//
// The real pool is constructed lazily (on first use, not at module load) so it always
// sees the env vars regardless of whether the .env file was loaded before or after
// this module was imported. The Proxy makes that transparent to callers — `pool.query(...)`
// works exactly as if `pool` were the real mysql2 Pool.
let realPool = null;
function getRealPool() {
    if (!realPool) {
        realPool = promise_1.default.createPool({
            host: process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? '68.178.198.174' : 'localhost'),
            port: 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'myclubgolf',
        });
    }
    return realPool;
}
const pool = new Proxy({}, {
    get(_target, prop, receiver) {
        return Reflect.get(getRealPool(), prop, receiver);
    },
});
exports.default = pool;
