"use strict";
/**
 * Pure stroke-allocation math for a single match -- given each player's Course Handicap (from
 * their picked tee, see matchtees.tsx) and the match's format, works out which holes each player
 * gets a stroke on. No DB/network access; the caller (rydermatch.tsx) already has everything
 * this needs from getMatchPlayerTees, getMatchSetup, and getRyderOptions.
 *
 * Confirmed with Matt 2026-08-06:
 * - Better Ball: everyone plays off the match's lowest Course Handicap (fixed, not a setting).
 * - Alternate Shot: each team's Course Handicap = altShotLowPct% of its lower-handicap partner
 *   + altShotHighPct% of its higher-handicap partner (defaults 60/40), then the two teams'
 *   Course Handicaps are compared exactly like two players would be.
 * - "Other" sessions never get strokes -- there's no defined rule for them.
 * - Front-9/Back-9 sessions have their own wrinkle (nineHoleHalfStrokes, see effectiveCH below);
 *   All-18 sessions always use the raw Course Handicap difference, one stroke per hole.
 * - Strokes are allocated hardest hole first (lowest stroke index among the holes actually being
 *   played), wrapping around to a second stroke on the same holes if the difference exceeds the
 *   hole count -- same convention real scorecards use.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeMatchStrokes = computeMatchStrokes;
exports.getScoringUnits = getScoringUnits;
exports.computeHoleWinnerFromScores = computeHoleWinnerFromScores;
/**
 * A side's (player's or team's) Course Handicap, adjusted for a Front-9/Back-9 session.
 * All-18 sessions, and the "half strokes on" mode, pass the raw value straight through --
 * halving happens at allocation time in half-stroke units for "half strokes on" (see `allocate`
 * below), not here. "Half strokes off" is the actual USGA 9-hole Course Handicap method: halve
 * and round individually first (Math.round rounds .5 up for positive numbers, matching that
 * convention), so the difference taken later is always a whole number.
 */
function effectiveCourseHandicap(rawCH, isNineHole, nineHoleHalfStrokes) {
    if (!isNineHole || nineHoleHalfStrokes)
        return rawCH;
    return Math.round(rawCH / 2);
}
function computeMatchStrokes(input) {
    const { players, format, holes, altShotLowPct, altShotHighPct, nineHoleHalfStrokes } = input;
    const isNineHole = holes.length === 9;
    const unitSize = isNineHole && nineHoleHalfStrokes ? 0.5 : 1;
    const ranked = [...holes].sort((a, b) => a.hdcp - b.hdcp);
    const emptyAllocation = () => Object.fromEntries(holes.map((h) => [h.hole, 0]));
    // `units` counts steps of `unitSize` each -- e.g. a 3-stroke 18-hole-style difference in
    // half-stroke mode is 3 units of 0.5. `stepsPerHole` is how many units it takes to fill one
    // hole to a full stroke (2 for half-stroke mode, 1 otherwise) -- each hole absorbs that many
    // consecutive units before moving to the next-hardest, so 3 units of 0.5 lands as 1.0 on the
    // hardest hole (its 2 units) then 0.5 on the next-hardest (its 1 remaining unit), not spread
    // as three separate 0.5s across three different holes.
    const stepsPerHole = Math.round(1 / unitSize);
    const allocate = (units) => {
        const allocation = emptyAllocation();
        for (let i = 0; i < units; i++) {
            const holeIndex = Math.floor(i / stepsPerHole) % ranked.length;
            allocation[ranked[holeIndex].hole] += unitSize;
        }
        return allocation;
    };
    const result = new Map();
    if (format === 'O') {
        for (const p of players)
            result.set(p.playerId, emptyAllocation());
        return result;
    }
    if (format === 'A') {
        const teamU = players.filter((p) => p.team === 'U');
        const teamE = players.filter((p) => p.team === 'E');
        const teamRawCH = (team) => {
            const chs = team.map((p) => p.courseHandicap);
            const lowCH = Math.min(...chs);
            const highCH = Math.max(...chs);
            return (altShotLowPct / 100) * lowCH + (altShotHighPct / 100) * highCH;
        };
        // The percentage blend can land on a fraction (e.g. 60% of 11 + 40% of 24 = 16.2) even
        // before any nine-hole adjustment -- round to a whole Course Handicap first, same as a real
        // player's would be, then apply the same nine-hole rule everything else uses.
        const uEff = effectiveCourseHandicap(Math.round(teamRawCH(teamU)), isNineHole, nineHoleHalfStrokes);
        const eEff = effectiveCourseHandicap(Math.round(teamRawCH(teamE)), isNineHole, nineHoleHalfStrokes);
        const minEff = Math.min(uEff, eEff);
        const uAllocation = allocate(uEff - minEff);
        const eAllocation = allocate(eEff - minEff);
        for (const p of teamU)
            result.set(p.playerId, uAllocation);
        for (const p of teamE)
            result.set(p.playerId, eAllocation);
        return result;
    }
    // Better Ball ('B') and Singles (null): everyone plays off the match's lowest handicap.
    const withEff = players.map((p) => ({ ...p, eff: effectiveCourseHandicap(p.courseHandicap, isNineHole, nineHoleHalfStrokes) }));
    const minEff = Math.min(...withEff.map((p) => p.eff));
    for (const p of withEff) {
        result.set(p.playerId, allocate(p.eff - minEff));
    }
    return result;
}
function getScoringUnits(players, format) {
    if (format === 'A') {
        const units = [];
        for (const team of ['U', 'E']) {
            const teamPlayers = players.filter((p) => p.team === team);
            if (teamPlayers.length === 0)
                continue;
            units.push({
                key: `team-${team}`,
                label: teamPlayers.map((p) => p.name).join(' & '),
                team,
                playerIds: teamPlayers.map((p) => p.playerId),
            });
        }
        return units;
    }
    return players.map((p) => ({ key: `player-${p.playerId}`, label: p.name, team: p.team, playerIds: [p.playerId] }));
}
/**
 * Work out which team won a hole from entered gross scores -- each team's hole score is its
 * best (lowest) net among its units (for Better Ball/Other/Singles, "best of its players"; for
 * Alternate Shot, trivially its one shared team score), net = gross - strokes on that hole
 * (0 if Handicaps is off, or always for an 'O' session). Returns null if any unit on either side
 * hasn't entered a score for this hole yet -- the caller should treat that as "not decided yet",
 * not as a halved hole.
 */
function computeHoleWinnerFromScores(units, grossScores, strokesThisHole) {
    const teamBestNet = (team) => {
        const teamUnits = units.filter((u) => u.team === team);
        if (teamUnits.length === 0)
            return null;
        const nets = teamUnits.map((u) => {
            const gross = grossScores[u.playerIds[0]];
            if (gross === undefined)
                return null;
            const strokes = strokesThisHole[u.playerIds[0]] ?? 0;
            return gross - strokes;
        });
        if (nets.some((n) => n === null))
            return null;
        return Math.min(...nets);
    };
    const uNet = teamBestNet('U');
    const eNet = teamBestNet('E');
    if (uNet === null || eNet === null)
        return null;
    if (uNet < eNet)
        return 'U';
    if (eNet < uNet)
        return 'E';
    return 'B';
}
