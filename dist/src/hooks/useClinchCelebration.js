"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useClinchCelebration = useClinchCelebration;
const react_1 = require("react");
const apiService_1 = require("../services/apiService");
const clinchSeen_1 = require("../utils/clinchSeen");
/** Poll cadence once a clinch is mathematically reachable — tight, to catch the deciding match
 * within half a minute of it being recorded. */
const POLL_WHEN_POSSIBLE_MS = 30000;
/** Poll cadence while a clinch is still comfortably impossible (early sessions) — you literally
 * can't clinch yet, so there's nothing to catch; just check occasionally for when enough points
 * have been decided that it becomes possible. A DBA-friendly ~10x fewer requests during most of
 * the event. */
const POLL_WHEN_IMPOSSIBLE_MS = 300000;
/** Once within this many points of a clinch becoming possible, poll at the tight cadence anyway —
 * so the impossible→possible→clinched transition (which can all happen inside one slow window near
 * the end) is never missed by up to 5 minutes. */
const NEAR_POSSIBLE_POINTS = 3;
const CURRENT_YEAR = new Date().getFullYear();
/**
 * Checks (and polls, until clinched) whether the Cup has been clinched this year, showing the
 * celebration once per device -- lives at the app root (app/_layout.tsx) so it shows up no
 * matter what screen is open when it's decided. Only ever checks the real current year, not
 * whatever year a screen's own picker happens to be browsing (confirmed with Matt 2026-07-26:
 * this is a live-event moment, not something that should pop up while browsing an old,
 * already-decided year). Polling stops for good the moment a clinch is found -- see the `check`
 * function below.
 *
 * `enabled` should be the screen's own focus state (see useIsFocused) -- Expo Router keeps
 * previous stack screens mounted rather than unmounting them, so without this a backgrounded
 * screen keeps polling and burning requests forever, and (worse) its Modal, which portals
 * straight to document.body, can pop up on top of whatever screen you're actually looking at.
 * Confirmed with Matt 2026-07-27: duplicating a Leaderboard tab then navigating it to Menu left
 * the original Leaderboard instance mounted in the background, and its celebration fired over
 * the Menu screen a few seconds later.
 */
function useClinchCelebration(groupId, enabled) {
    const [info, setInfo] = (0, react_1.useState)(null);
    const [visible, setVisible] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!groupId || !enabled)
            return;
        let cancelled = false;
        let timer;
        // Self-scheduling (setTimeout, not setInterval) so the cadence can adapt to whether a clinch
        // is even reachable yet: while it's mathematically impossible (early sessions) the server
        // answers with a cheap COUNT and we poll slowly; once it's possible we tighten to 30s to catch
        // the deciding match promptly; once it's clinched we stop for good.
        const check = () => {
            (0, apiService_1.getClinchStatus)(CURRENT_YEAR, groupId).then((status) => {
                if (cancelled || !status) {
                    // Network blip -- retry on the slow cadence rather than giving up.
                    if (!cancelled)
                        timer = setTimeout(check, POLL_WHEN_IMPOSSIBLE_MS);
                    return;
                }
                if (status.clinch) {
                    setInfo(status.clinch);
                    if (!(0, clinchSeen_1.hasSeenClinchCelebration)(CURRENT_YEAR, groupId))
                        setVisible(true);
                    // Outcome is permanent for the year -- stop polling entirely (confirmed with Matt
                    // 2026-07-27). A fresh page load later still gets exactly one check to learn it.
                    return;
                }
                const tight = status.possible || status.pointsUntilPossible <= NEAR_POSSIBLE_POINTS;
                timer = setTimeout(check, tight ? POLL_WHEN_POSSIBLE_MS : POLL_WHEN_IMPOSSIBLE_MS);
            });
        };
        check();
        return () => {
            cancelled = true;
            if (timer)
                clearTimeout(timer);
        };
    }, [groupId, enabled]);
    const dismiss = () => {
        setVisible(false);
        (0, clinchSeen_1.markClinchCelebrationSeen)(CURRENT_YEAR, groupId);
    };
    return { info, visible, dismiss };
}
