"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePageVisible = usePageVisible;
const react_1 = require("react");
/**
 * Whether the browser tab is actually visible right now (web only) -- Matt, 2026-08-21: a
 * Standings/Leaderboard tab left open overnight (or just backgrounded, phone locked, laptop
 * closed) shouldn't keep polling. Distinct from expo-router's useIsFocused, which only tracks
 * *navigation* focus (is this the active screen within the app's own stack) -- a screen can be
 * the app's current route while the whole tab/window sits hidden or the device is locked, and
 * useIsFocused alone has no way to know that. Defaults to true on native (no Page Visibility
 * API there), same "degrade gracefully rather than pull in a new dependency" reasoning as
 * clinchSeen.ts's own web-only guard.
 */
function usePageVisible() {
    const getVisible = () => {
        const d = globalThis.document;
        return !d || d.visibilityState !== 'hidden';
    };
    const [visible, setVisible] = (0, react_1.useState)(getVisible);
    (0, react_1.useEffect)(() => {
        const d = globalThis.document;
        if (!d)
            return;
        const onChange = () => setVisible(getVisible());
        d.addEventListener('visibilitychange', onChange);
        onChange();
        return () => d.removeEventListener('visibilitychange', onChange);
    }, []);
    return visible;
}
