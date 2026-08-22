"use strict";
/**
 * Handicap display/parse helpers, matching Scorecard's golf convention: a "plus" handicapper
 * (better than scratch) is stored as a NEGATIVE number everywhere but shown with a leading "+"
 * (e.g. -2 displays as "+2"), and can be typed either as "+2" or "-2". Keeping this identical to
 * Scorecard's src/utils/handicap.ts so the two apps behave the same. The stroke-allocation math
 * (strokeAllocation.ts) already works on the raw signed number, so these are display/entry only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatHdcp = formatHdcp;
exports.formatHdcpIndex = formatHdcpIndex;
exports.parseHdcp = parseHdcp;
/** A whole-number Course Handicap for display: "+2", "0", "14". */
function formatHdcp(hdcp) {
    if (hdcp === null || hdcp === undefined)
        return '';
    return hdcp < 0 ? `+${Math.abs(hdcp)}` : `${hdcp}`;
}
/** A one-decimal Handicap Index for display: "+1.2", "0.0", "14.3". */
function formatHdcpIndex(hdcp) {
    if (hdcp === null || hdcp === undefined)
        return '';
    return hdcp < 0 ? `+${Math.abs(hdcp).toFixed(1)}` : hdcp.toFixed(1);
}
/**
 * Parses a typed handicap, honoring that plus handicappers type a leading "+" (e.g. "+5") even
 * though it's stored negative (-5). A directly-typed "-5" parses the same way. Returns NaN for
 * blank/garbage so callers can reject it (unlike Scorecard's version, which defaults to 0 — here
 * an empty box means "leave unchanged", not "set to scratch").
 */
function parseHdcp(raw) {
    const trimmed = raw.trim();
    if (trimmed === '')
        return NaN;
    if (trimmed.startsWith('+')) {
        const magnitude = Number(trimmed.slice(1));
        return Number.isNaN(magnitude) ? NaN : -magnitude;
    }
    const n = Number(trimmed);
    return Number.isNaN(n) ? NaN : n;
}
