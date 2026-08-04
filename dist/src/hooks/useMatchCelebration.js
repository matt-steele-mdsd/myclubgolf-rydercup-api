"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMatchCelebration = useMatchCelebration;
const react_1 = require("react");
const apiService_1 = require("../services/apiService");
const CURRENT_YEAR = new Date().getFullYear();
/**
 * Detects matches finishing while this screen is open (Show Results, Session Leaderboard, or
 * Scorecard) and queues them for a "Congratulations"/"Match Tied" celebration -- distinct from
 * useClinchCelebration, which is about the Cup as a whole. Only ever checks the current calendar
 * year, same reasoning as the clinch hook: this is a live-event notification, not something that
 * should fire while browsing an old, already-decided year.
 *
 * Whatever's already completed as of this screen's first fetch is the baseline (not celebrated --
 * you only see a celebration for something that finishes while you're actually watching), so this
 * resets per screen visit rather than persisting "seen" state like the clinch celebration does.
 *
 * `enabled` should be the screen's own focus state (see useIsFocused) -- Expo Router keeps
 * previous stack screens mounted rather than unmounting them, so without this a backgrounded
 * screen keeps polling and burning requests forever, and (worse) its Modal, which portals
 * straight to document.body, can pop up on top of whatever screen you're actually looking at.
 * Confirmed with Matt 2026-07-27: duplicating a Leaderboard tab then navigating it to Menu left
 * the original Leaderboard instance mounted in the background, and its celebration fired over
 * the Menu screen a few seconds later. Losing focus re-baselines on the next regain (same as a
 * fresh visit), so nothing that finished while backgrounded gets celebrated retroactively.
 */
function useMatchCelebration(groupId, enabled) {
    const [queue, setQueue] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        if (!groupId || !enabled)
            return;
        let cancelled = false;
        let seen = null;
        const check = () => {
            (0, apiService_1.getRyderCompletedMatches)(CURRENT_YEAR, groupId).then((matches) => {
                if (cancelled)
                    return;
                if (seen === null) {
                    seen = new Set(matches.map((m) => m.matchId));
                    return;
                }
                const newlyCompleted = matches.filter((m) => !seen.has(m.matchId));
                if (newlyCompleted.length > 0) {
                    newlyCompleted.forEach((m) => seen.add(m.matchId));
                    setQueue((prev) => [...prev, ...newlyCompleted]);
                }
            });
        };
        check();
        const interval = setInterval(check, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [groupId, enabled]);
    const current = queue[0] ?? null;
    const dismiss = () => setQueue((prev) => prev.slice(1));
    return { current, dismiss };
}
