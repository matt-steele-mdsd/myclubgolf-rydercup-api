"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSeenClinchCelebration = hasSeenClinchCelebration;
exports.markClinchCelebrationSeen = markClinchCelebrationSeen;
/**
 * Whether this device has already shown the Cup-clinched celebration for a given year --
 * localStorage-based (web only). This app has no native local-storage dependency yet, and
 * adding one (e.g. AsyncStorage) would need a fresh native build before it could even be used --
 * so this degrades gracefully to "never persists, shows every time" on native rather than
 * pulling in a new dependency for one convenience feature. Fine for now since real usage is the
 * Chromebook/web client.
 */
function storageKey(year) {
    return `rydercup_clinch_seen_${year}`;
}
// Accessed via globalThis (not the `window` identifier) so this file doesn't need the DOM lib --
// this project's tsconfigs (client and server) don't include it since it's a React Native app.
function getLocalStorage() {
    const w = globalThis.window;
    return w && w.localStorage ? w.localStorage : null;
}
function hasSeenClinchCelebration(year) {
    try {
        const storage = getLocalStorage();
        return !!storage && storage.getItem(storageKey(year)) === '1';
    }
    catch {
        return false;
    }
}
function markClinchCelebrationSeen(year) {
    try {
        const storage = getLocalStorage();
        if (storage)
            storage.setItem(storageKey(year), '1');
    }
    catch {
        // Purely a "don't show again" convenience -- never worth failing anything over.
    }
}
