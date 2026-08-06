"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCaptainVerified = isCaptainVerified;
exports.setCaptainVerified = setCaptainVerified;
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
const STORAGE_KEY_PREFIX = 'captainVerified:';
/** Local calendar date as "YYYY-MM-DD" — matches the device's own day boundary, not UTC's, so
 * the verification expires at local midnight the same way a person would expect "today." Mirrors
 * Scorecard's adminAuth.ts. */
function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/**
 * Whether this device has already entered the correct Captains password for a given group
 * TODAY — stored locally per device (mirrors Scorecard's isAdminVerified), so a captain
 * working through several admin screens in one session doesn't have to retype the password
 * every time they return to Menu. Scoped to the calendar day rather than persisting
 * indefinitely, same reasoning as Scorecard: coming back another day should prompt again
 * rather than looking like the password protection silently stopped working.
 */
async function isCaptainVerified(groupId) {
    try {
        const stored = await async_storage_1.default.getItem(`${STORAGE_KEY_PREFIX}${groupId}`);
        return stored === todayKey();
    }
    catch (error) {
        console.error('Error reading captain verification status:', error);
        return false;
    }
}
/** Record that this device just entered the correct Captains password for a group, good for
 * the rest of today (local time). */
async function setCaptainVerified(groupId) {
    try {
        await async_storage_1.default.setItem(`${STORAGE_KEY_PREFIX}${groupId}`, todayKey());
    }
    catch (error) {
        console.error('Error saving captain verification status:', error);
    }
}
