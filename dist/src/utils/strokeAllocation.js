"use strict";
/**
 * Pure stroke-allocation math for a single match -- given each player's Course Handicap (from
 * their picked tee, see matchtees.tsx) and the match's format, works out which holes each player
 * gets a stroke on. No DB/network access; the caller (rydermatch.tsx) already has everything
 * this needs from getMatchPlayerTees, getMatchSetup, and getRyderOptions.
 *
 * Confirmed with Matt 2026-08-06:
 * - Better Ball: everyone plays off the match's lowest Course Handicap (fixed, not a setting).
 * - Aggregate (2026-08-17): same stroke rule as Better Ball -- each player strokes off their own
 *   Course Handicap relative to the match's lowest -- only how the two teammates' net scores
 *   combine into a team hole score differs (summed instead of best-of, see computeTeamNet).
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
exports.computeHandicapStrokesPerPlayer = computeHandicapStrokesPerPlayer;
exports.buildStrokeSummaryLines = buildStrokeSummaryLines;
exports.getScoringUnits = getScoringUnits;
exports.computeTeamNet = computeTeamNet;
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
    // Default on (each gender on its own stroke index) when omitted. When off, every allocate() call
    // is collapsed to the men's ranking below, so women stroke on the men's handicap holes.
    const womenHandicapHoles = input.womenHandicapHoles !== false;
    const isNineHole = holes.length === 9;
    const unitSize = isNineHole && nineHoleHalfStrokes ? 0.5 : 1;
    const hdcpFor = (h, gender) => (gender === 'M' ? h.hdcpMale : h.hdcpFemale) ?? h.hdcp;
    // Two separate rankings, not one shared list -- Men's and Women's stroke-index order can
    // genuinely differ hole-to-hole (confirmed with real GHIN data 2026-08-06), so each player's
    // strokes land according to their own gender's card, not a single "the" ranking.
    const rankedByGender = {
        M: [...holes].sort((a, b) => hdcpFor(a, 'M') - hdcpFor(b, 'M')),
        F: [...holes].sort((a, b) => hdcpFor(a, 'F') - hdcpFor(b, 'F')),
    };
    const emptyAllocation = () => Object.fromEntries(holes.map((h) => [h.hole, 0]));
    // `units` counts steps of `unitSize` each -- e.g. a 3-stroke 18-hole-style difference in
    // half-stroke mode is 3 units of 0.5. `stepsPerHole` is how many units it takes to fill one
    // hole to a full stroke (2 for half-stroke mode, 1 otherwise) -- each hole absorbs that many
    // consecutive units before moving to the next-hardest, so 3 units of 0.5 lands as 1.0 on the
    // hardest hole (its 2 units) then 0.5 on the next-hardest (its 1 remaining unit), not spread
    // as three separate 0.5s across three different holes.
    const stepsPerHole = Math.round(1 / unitSize);
    const allocate = (units, gender) => {
        const ranked = rankedByGender[womenHandicapHoles ? gender : 'M'];
        const allocation = emptyAllocation();
        for (let i = 0; i < units; i++) {
            const holeIndex = Math.floor(i / stepsPerHole) % ranked.length;
            allocation[ranked[holeIndex].hole] += unitSize;
        }
        return allocation;
    };
    const result = new Map();
    if (format === 'O' || format === 'C') {
        // Scramble ('C') has no defined stroke-allocation rule either (house rules for scramble
        // handicap allowances vary too much to pick one) -- treated like 'O': zero strokes for
        // everyone, same as Other, until a real rule is asked for.
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
        // The shared team ball needs one ranking, not one per partner -- uses whichever partner's
        // Course Handicap is lower, same partner whose share of the blend is the bigger one
        // (altShotLowPct). Moot for the overwhelmingly common same-gender team.
        const genderOf = (team) => team.reduce((low, p) => (p.courseHandicap < low.courseHandicap ? p : low)).gender;
        // The percentage blend can land on a fraction (e.g. 60% of 11 + 40% of 24 = 16.2) even
        // before any nine-hole adjustment -- round to a whole Course Handicap first, same as a real
        // player's would be, then apply the same nine-hole rule everything else uses.
        const uEff = effectiveCourseHandicap(Math.round(teamRawCH(teamU)), isNineHole, nineHoleHalfStrokes);
        const eEff = effectiveCourseHandicap(Math.round(teamRawCH(teamE)), isNineHole, nineHoleHalfStrokes);
        const minEff = Math.min(uEff, eEff);
        const uAllocation = allocate(uEff - minEff, genderOf(teamU));
        const eAllocation = allocate(eEff - minEff, genderOf(teamE));
        for (const p of teamU)
            result.set(p.playerId, uAllocation);
        for (const p of teamE)
            result.set(p.playerId, eAllocation);
        return result;
    }
    // Better Ball ('B') and Singles (null): everyone plays off the match's lowest handicap, but
    // each player's own strokes still land according to their own gender's stroke-index order.
    const withEff = players.map((p) => ({ ...p, eff: effectiveCourseHandicap(p.courseHandicap, isNineHole, nineHoleHalfStrokes) }));
    const minEff = Math.min(...withEff.map((p) => p.eff));
    for (const p of withEff) {
        result.set(p.playerId, allocate(p.eff - minEff, p.gender));
    }
    return result;
}
/**
 * Each player's WHOLE handicap strokes per hole off their OWN full Course Handicap -- NOT the
 * match-play "off the low" difference computeMatchStrokes gives. This is for GHIN "most likely
 * score" fill-ins on holes that were never played because the match was already decided: the USGA
 * rule is you post par + the strokes you're entitled to on each remaining hole (par if 0 strokes,
 * bogey if 1, double if 2, ...). Whole strokes only -- GHIN scores are whole numbers, so there's
 * no half-stroke mode here; a nine-hole session halves-and-rounds the Course Handicap the standard
 * USGA way. A plus handicap yields -1 on its hardest holes (most-likely below par there), which is
 * the same net-par concept run the other direction.
 */
function computeHandicapStrokesPerPlayer(input) {
    const { players, holes } = input;
    const womenHandicapHoles = input.womenHandicapHoles !== false;
    const isNineHole = holes.length === 9;
    const hdcpFor = (h, gender) => (gender === 'M' ? h.hdcpMale : h.hdcpFemale) ?? h.hdcp;
    const rankedByGender = {
        M: [...holes].sort((a, b) => hdcpFor(a, 'M') - hdcpFor(b, 'M')),
        F: [...holes].sort((a, b) => hdcpFor(a, 'F') - hdcpFor(b, 'F')),
    };
    const result = new Map();
    for (const p of players) {
        const eff = isNineHole ? Math.round(p.courseHandicap / 2) : p.courseHandicap;
        const ranked = rankedByGender[womenHandicapHoles ? p.gender : 'M'];
        const allocation = Object.fromEntries(holes.map((h) => [h.hole, 0]));
        const count = Math.abs(eff);
        const sign = eff >= 0 ? 1 : -1;
        for (let i = 0; i < count; i++)
            allocation[ranked[i % ranked.length].hole] += sign;
        result.set(p.playerId, allocation);
    }
    return result;
}
/**
 * Plain-English explanation of who plays off scratch and which holes everyone else strokes on
 * for a match, shown once up front (matchtees.tsx, before "Start Match") rather than repeated
 * on hole 1/10 -- confirmed with Matt 2026-08-06: the per-hole "Strokes This Hole" box is the
 * ongoing in-play reference, this is just the up-front orientation. 'O' sessions never get
 * strokes (no defined rule), so there's nothing to explain for those.
 */
/** "Chris Dietz" / "Chris Dietz and Jason Rutkoski" / "Chris Dietz, Jason Rutkoski, and Pete
 * Westerheide" -- for listing every player tied for the match's lowest handicap. */
function joinNames(names) {
    if (names.length <= 1)
        return names[0] ?? '';
    if (names.length === 2)
        return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
function buildStrokeSummaryLines(allocation, players, format) {
    if (format === 'O' || format === 'C' || players.length === 0)
        return [];
    const holesList = (playerId) => Object.entries(allocation.get(playerId) ?? {})
        .map(([h, s]) => ({ hole: Number(h), strokes: s }))
        .filter((h) => h.strokes > 0)
        .sort((a, b) => a.hole - b.hole);
    const totalFor = (playerId) => holesList(playerId).reduce((sum, h) => sum + h.strokes, 0);
    const formatHoles = (hs) => hs.map((h) => (h.strokes === 1 ? `${h.hole}` : `${h.hole} (${h.strokes})`)).join(', ');
    const lines = [];
    if (format === 'A') {
        const teamU = players.filter((p) => p.team === 'U');
        const teamE = players.filter((p) => p.team === 'E');
        const uTotal = teamU[0] ? totalFor(teamU[0].playerId) : 0;
        const eTotal = teamE[0] ? totalFor(teamE[0].playerId) : 0;
        // Equal team handicaps -> neither team strokes (both totals are 0, since strokes are relative
        // to the lower team). Naming one team as "the lower team" here reads as if the other is higher,
        // so say plainly that it's even instead.
        if (uTotal === eTotal) {
            lines.push({ prefix: 'Handicaps are the same — no strokes this match.', boldName: '', suffix: '' });
            return lines;
        }
        const scratchTeam = uTotal <= eTotal ? teamU : teamE;
        const strokeTeam = uTotal <= eTotal ? teamE : teamU;
        lines.push({
            prefix: 'We are playing off the lower team handicap: ',
            boldName: scratchTeam.map((p) => p.name).join(' & '),
            suffix: ' — that team gets no strokes.',
        });
        if (strokeTeam.length > 0) {
            const total = totalFor(strokeTeam[0].playerId);
            lines.push({
                prefix: '',
                boldName: strokeTeam.map((p) => p.name).join(' & '),
                suffix: ` get ${total} stroke${total === 1 ? '' : 's'}: holes ${formatHoles(holesList(strokeTeam[0].playerId))}.`,
            });
        }
    }
    else {
        // The lowest handicap always nets to 0 strokes by construction -- but when two or more
        // players are tied for it (e.g. same Course Handicap), only the first one used to get named
        // here, and the rest were silently skipped by the total===0 check below instead of being
        // listed as also getting no strokes (confirmed real case, Matt 2026-08-07: Chris Dietz and
        // Jason Rutkoski tied, Jason never appeared anywhere in the summary).
        const scratchPlayers = players.filter((p) => totalFor(p.playerId) === 0);
        const strokePlayers = players.filter((p) => totalFor(p.playerId) > 0);
        // Nobody strokes -> everyone's off the same handicap (e.g. a Singles match where both players
        // have the same Course Handicap). Naming them all as "the lowest handicap" reads oddly, so say
        // plainly it's even instead.
        if (strokePlayers.length === 0) {
            lines.push({ prefix: 'Handicaps are the same — no strokes this match.', boldName: '', suffix: '' });
            return lines;
        }
        lines.push({
            prefix: 'We are playing off the lowest handicap, which is ',
            boldName: joinNames(scratchPlayers.map((p) => p.name)),
            suffix: ' — gets no strokes.',
        });
        for (const p of strokePlayers) {
            const total = totalFor(p.playerId);
            lines.push({
                prefix: '',
                boldName: p.name,
                suffix: ` gets ${total} stroke${total === 1 ? '' : 's'}: holes ${formatHoles(holesList(p.playerId))}.`,
            });
        }
    }
    return lines;
}
function getScoringUnits(players, format) {
    if (format === 'A' || format === 'C') {
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
 * A team's combined net score for one hole among its scoring units, net = gross - strokes on
 * that hole (0 if Handicaps is off, or always for an 'O' session). For Aggregate ('G') that's the
 * SUM of both teammates' net scores -- the whole point of the format is that both scores count,
 * not just the better one. For every other format it's the MINIMUM (best-of-its-players for
 * Better Ball/Other/Singles; trivially its one shared team score for Alternate Shot/Scramble).
 * Returns null if any unit on this side hasn't entered a score for this hole yet. Shared by
 * `computeHoleWinnerFromScores` (match play, per hole) and stroke-play finalize (server-side,
 * summed across every hole) -- see `finalizeStrokePlayMatch` in ryderService.ts.
 */
function computeTeamNet(units, team, grossScores, strokesThisHole, format) {
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
    const numNets = nets;
    return format === 'G' ? numNets.reduce((sum, n) => sum + n, 0) : Math.min(...numNets);
}
/**
 * Work out which team won a hole from entered gross scores -- returns null if either side hasn't
 * entered a score for this hole yet, the caller should treat that as "not decided yet", not as a
 * halved hole.
 */
function computeHoleWinnerFromScores(units, grossScores, strokesThisHole, format) {
    const uNet = computeTeamNet(units, 'U', grossScores, strokesThisHole, format);
    const eNet = computeTeamNet(units, 'E', grossScores, strokesThisHole, format);
    if (uNet === null || eNet === null)
        return null;
    if (uNet < eNet)
        return 'U';
    if (eNet < uNet)
        return 'E';
    return 'B';
}
