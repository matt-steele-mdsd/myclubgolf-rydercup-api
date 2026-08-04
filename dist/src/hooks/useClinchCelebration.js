"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useClinchCelebration = useClinchCelebration;
const react_1 = require("react");
const apiService_1 = require("../services/apiService");
const clinchSeen_1 = require("../utils/clinchSeen");
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
        const check = () => {
            (0, apiService_1.getRyderClinchInfo)(CURRENT_YEAR, groupId).then((result) => {
                if (cancelled || !result)
                    return;
                setInfo(result);
                if (!(0, clinchSeen_1.hasSeenClinchCelebration)(CURRENT_YEAR))
                    setVisible(true);
                // Once clinched, the outcome is permanent for the year -- nothing left to change, so
                // stop polling entirely rather than hitting the DB every 30s forever (confirmed with Matt
                // 2026-07-27). The one check that found it is enough; a fresh page load later still gets
                // exactly one check to learn the already-decided state.
                clearInterval(interval);
            });
        };
        check();
        const interval = setInterval(check, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [groupId, enabled]);
    const dismiss = () => {
        setVisible(false);
        (0, clinchSeen_1.markClinchCelebrationSeen)(CURRENT_YEAR);
    };
    return { info, visible, dismiss };
}
