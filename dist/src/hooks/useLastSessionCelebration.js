"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLastSessionCelebration = useLastSessionCelebration;
const react_1 = require("react");
const apiService_1 = require("../services/apiService");
const CURRENT_YEAR = new Date().getFullYear();
const POLL_MS = 30000;
/**
 * Same "Congratulations"/"Match Tied" celebration as useMatchCelebration, but for the LAST
 * session only, and shown on EVERY screen -- not just Show Results, Session Leaderboard, and
 * Scorecard. Lives at the app root (app/_layout.tsx), same placement/reasoning as
 * useClinchCelebration: this is the one place that wraps every screen, so it's the only spot
 * that needs to poll.
 *
 * Confirmed with Matt, 2026-08-17 (the day after the event): during the final session hardly
 * anyone actually had Session Leaderboard open -- in practice it was just the scorers using the
 * app at all, so the existing per-screen celebration (which only fires for whoever happens to be
 * on one of those 3 screens) was reaching almost nobody right when it mattered most. Deliberately
 * scoped to the LAST session only, not every session all event long -- earlier sessions keep the
 * existing quieter, screen-scoped behavior (see useMatchCelebration, which excludes the last
 * session so the two hooks never double-fire the same match).
 *
 * Stops entirely once the Cup is clinched (via getClinchStatus, same source as
 * useClinchCelebration) -- once it's decided, the Cup-level celebration is the one that matters,
 * and there's no need to keep interrupting every screen with individual match results.
 *
 * `enabled` should reflect whether there's an event to check at all (see _layout.tsx's
 * `hasEventContext`) -- this is the app root, always mounted, so there's no per-screen focus
 * gating needed the way the screen-scoped hooks require.
 */
function useLastSessionCelebration(groupId, enabled) {
    const [queue, setQueue] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (!groupId || !enabled)
            return;
        let cancelled = false;
        let timer;
        // Keyed matchId -> winner, same reasoning as useMatchCelebration: a corrected winner should
        // re-fire with the corrected team, not just once with whatever showed up first.
        let seen = null;
        const check = () => {
            Promise.all([
                (0, apiService_1.getRyderCompletedMatches)(CURRENT_YEAR, groupId),
                (0, apiService_1.getSessionsForYear)(CURRENT_YEAR, groupId),
                (0, apiService_1.getClinchStatus)(CURRENT_YEAR, groupId),
            ]).then(([allMatches, sessions, status]) => {
                if (cancelled)
                    return;
                if (status?.clinch)
                    return; // Decided -- stop for good, don't reschedule.
                const lastSessionId = sessions.length > 0 ? Math.max(...sessions.map((s) => s.sessionId)) : null;
                const matches = lastSessionId === null ? [] : allMatches.filter((m) => m.sessionId === lastSessionId);
                if (seen === null) {
                    seen = new Map(matches.map((m) => [m.matchId, m.winner]));
                }
                else {
                    const newlyCompleted = matches.filter((m) => seen.get(m.matchId) !== m.winner);
                    if (newlyCompleted.length > 0) {
                        newlyCompleted.forEach((m) => seen.set(m.matchId, m.winner));
                        setQueue((prev) => [...prev, ...newlyCompleted]);
                    }
                }
                timer = setTimeout(check, POLL_MS);
            });
        };
        check();
        return () => {
            cancelled = true;
            if (timer)
                clearTimeout(timer);
        };
    }, [groupId, enabled]);
    const current = queue[0] ?? null;
    const dismiss = () => setQueue((prev) => prev.slice(1));
    return { current, dismiss };
}
