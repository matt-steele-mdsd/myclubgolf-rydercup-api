"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEventCancelled = useEventCancelled;
const react_1 = require("react");
const apiService_1 = require("../services/apiService");
const CURRENT_YEAR = new Date().getFullYear();
/**
 * Whether the real current year is marked cancelled (see cancelEvent) for this group. Checked
 * once per groupId change, not on an interval -- same "nothing new is coming" reasoning as
 * hasLiveActivity: a cancelled year has no more matches left to play, so a captain un-cancelling
 * it (the only way this would ever flip back) will show up on the next natural refetch/focus
 * anyway. Used to gate the celebration/clinch polling hooks off once an event's cancelled (Matt,
 * 2026-08-16, after a rainout): there's nothing left for them to usefully watch for.
 */
function useEventCancelled(groupId) {
    const [cancelled, setCancelled] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!groupId)
            return;
        (0, apiService_1.getEventCancellationStatus)(groupId, CURRENT_YEAR).then((status) => setCancelled(status.cancelled));
    }, [groupId]);
    return cancelled;
}
