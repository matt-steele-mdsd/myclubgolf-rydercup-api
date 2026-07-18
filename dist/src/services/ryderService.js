"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GHIN_SYNC_USER = void 0;
exports.getRyderYears = getRyderYears;
exports.getRyderGroups = getRyderGroups;
exports.searchRyderEvents = searchRyderEvents;
exports.getRyderEventById = getRyderEventById;
exports.createRyderEvent = createRyderEvent;
exports.renameRyderEvent = renameRyderEvent;
exports.getCourseList = getCourseList;
exports.createCourse = createCourse;
exports.getEventCourse = getEventCourse;
exports.setEventCourse = setEventCourse;
exports.getEventCourseHistory = getEventCourseHistory;
exports.getSessionsForYear = getSessionsForYear;
exports.createSession = createSession;
exports.updateSession = updateSession;
exports.deleteSession = deleteSession;
exports.getRyderResults = getRyderResults;
exports.getRyderLeaderboard = getRyderLeaderboard;
exports.getRyderScorecard = getRyderScorecard;
exports.getSessionMatches = getSessionMatches;
exports.getMatchSetup = getMatchSetup;
exports.saveHoleScore = saveHoleScore;
exports.saveMatchResult = saveMatchResult;
exports.addPlayer = addPlayer;
exports.getPlayersForGroup = getPlayersForGroup;
exports.getPlayerRoster = getPlayerRoster;
exports.renamePlayer = renamePlayer;
exports.updatePlayerStatus = updatePlayerStatus;
exports.setPlayerRetired = setPlayerRetired;
exports.isSetupDoneForYear = isSetupDoneForYear;
exports.isRosterSavedForYear = isRosterSavedForYear;
exports.getYearRoster = getYearRoster;
exports.saveYearRoster = saveYearRoster;
exports.getActiveRosterForSetup = getActiveRosterForSetup;
exports.getSittingOutForSession = getSittingOutForSession;
exports.getLatestHdcp = getLatestHdcp;
exports.saveHdcp = saveHdcp;
exports.getMatchPairing = getMatchPairing;
exports.saveMatchPairing = saveMatchPairing;
exports.getResultsHistory = getResultsHistory;
exports.getPlayerRanking = getPlayerRanking;
const config_1 = __importDefault(require("../db/config"));
/**
 * Get every distinct Ryder Cup year on record, ascending — mirrors ryderhome.php's year
 * dropdown. If the current calendar year has no matches yet, it's added as a selectable
 * option too (so a new year's matches can be set up), same as the PHP page does.
 */
async function getRyderYears() {
    const [rows] = await config_1.default.query('SELECT DISTINCT RyderYear FROM RyderMatch ORDER BY RyderYear');
    const years = rows.map((r) => r.RyderYear);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) {
        years.push(currentYear);
        years.sort((a, b) => a - b);
    }
    return years;
}
/**
 * Get every Ryder Cup group ("event") on record, with its display name — mirrors phoneAI's
 * Events table (RyderEvents has the same shape: name + course + audit columns), just scoped
 * to RyderCup and keyed as GroupID (matching what RyderMatch/RyderPlayer/etc. already call
 * this column) rather than EventID. GroupID is still what flows through every other query in
 * this file — RyderEvents only exists to attach a human-readable name/course to it.
 */
async function getRyderGroups() {
    const [rows] = await config_1.default.query('SELECT GroupID, EventName FROM RyderEvents ORDER BY EventName');
    return rows.map((r) => ({ groupId: r.GroupID, eventName: r.EventName }));
}
/**
 * Search Ryder Cup events ("groups") by name or course — mirrors phoneAI's searchEvents,
 * scoped to RyderEvents instead of Events. Empty query returns everything. Unlike phoneAI,
 * an event's course isn't fixed — it can change year to year (see RyderCourse) — so the
 * "course" match here is against whichever course the event's most recent year used, just
 * for search/display purposes; it's not stored on the event itself.
 */
async function searchRyderEvents(query) {
    const trimmed = query.trim();
    const sql = `
    SELECT re.GroupID, re.EventName, c.CourseName
    FROM RyderEvents re
    LEFT JOIN (
      SELECT rc1.GroupID, rc1.CourseID
      FROM RyderCourse rc1
      WHERE rc1.RyderYear = (SELECT MAX(rc2.RyderYear) FROM RyderCourse rc2 WHERE rc2.GroupID = rc1.GroupID)
    ) latest ON latest.GroupID = re.GroupID
    LEFT JOIN Course c ON c.CourseID = latest.CourseID
    ${trimmed ? 'WHERE re.EventName LIKE ? OR c.CourseName LIKE ?' : ''}
    ORDER BY re.EventName
  `;
    const params = trimmed ? [`%${trimmed}%`, `%${trimmed}%`] : [];
    const [rows] = await config_1.default.query(sql, params);
    return rows.map((r) => ({ groupId: r.GroupID, eventName: r.EventName, courseName: r.CourseName ?? null }));
}
/**
 * Get a single Ryder Cup event by GroupID — used to show the fixed, read-only event name at
 * the top of every screen once one has been selected. Course isn't included here since it's
 * per-year, not per-event — see getEventCourse.
 */
async function getRyderEventById(groupId) {
    const [rows] = await config_1.default.query('SELECT GroupID, EventName FROM RyderEvents WHERE GroupID = ?', [groupId]);
    if (rows.length === 0)
        return null;
    return { groupId: rows[0].GroupID, eventName: rows[0].EventName };
}
/** Whether an event name is already in use by another event (case-insensitive, trimmed).
 * excludeGroupId is omitted when creating a brand-new event (nothing to exclude yet). */
async function isEventNameTaken(eventName, excludeGroupId) {
    const [rows] = await config_1.default.query(`SELECT GroupID FROM RyderEvents WHERE LOWER(EventName) = LOWER(?) ${excludeGroupId ? 'AND GroupID != ?' : ''}`, excludeGroupId ? [eventName.trim(), excludeGroupId] : [eventName.trim()]);
    return rows.length > 0;
}
/**
 * Create a new Ryder Cup event ("group") — mirrors phoneAI's createEvent. Also records the
 * chosen course for the current year via RyderCourse, since a brand-new event needs at least
 * one year's course set before matches can be scored against it. Rejects the name if another
 * event already has it (same check as renameRyderEvent).
 */
async function createRyderEvent(eventName, courseId) {
    const trimmed = eventName.trim();
    if (!trimmed)
        return { ok: false, error: 'Event name cannot be empty.' };
    if (await isEventNameTaken(trimmed)) {
        return { ok: false, error: 'That event name is already in use.' };
    }
    const [result] = await config_1.default.query('INSERT INTO RyderEvents (EventName, LastUpdateUser) VALUES (?, ?)', [trimmed, SCORER_NAME]);
    const groupId = result.insertId;
    await setEventCourse(groupId, new Date().getFullYear(), courseId);
    const event = await getRyderEventById(groupId);
    return { ok: true, event: event };
}
/**
 * Rename an event, rejecting the change if another event already has that name (checked
 * case-insensitively, e.g. "york real ryder cup" collides with "York Real Ryder Cup").
 */
async function renameRyderEvent(groupId, eventName) {
    const trimmed = eventName.trim();
    if (!trimmed)
        return { ok: false, error: 'Event name cannot be empty.' };
    if (await isEventNameTaken(trimmed, groupId)) {
        return { ok: false, error: 'That event name is already in use.' };
    }
    await config_1.default.query('UPDATE RyderEvents SET EventName = ?, LastUpdateUser = ? WHERE GroupID = ?', [trimmed, SCORER_NAME, groupId]);
    return { ok: true };
}
/**
 * Get every course on record, for course pickers.
 */
async function getCourseList() {
    const [rows] = await config_1.default.query('SELECT CourseID, CourseName FROM Course ORDER BY CourseName');
    return rows.map((r) => ({ courseId: r.CourseID, courseName: r.CourseName }));
}
/**
 * Create a brand-new course (shared Course/CourseDetails tables, same as phoneAI) with its 18
 * hole rows. Not tied to any Ryder event or year on its own — picking it for a given year
 * happens separately via setEventCourse.
 */
async function createCourse(courseName, holes, ghinInfo) {
    const [result] = await config_1.default.query('INSERT INTO Course (CourseName, CourseCity, CourseState, GHINClubName, GHINCourseId, LastUpdateUser) VALUES (?, ?, ?, ?, ?, ?)', [courseName, ghinInfo?.city ?? null, ghinInfo?.state ?? null, ghinInfo?.ghinClubName ?? null, ghinInfo ? String(ghinInfo.ghinCourseId) : null, SCORER_NAME]);
    const courseId = result.insertId;
    if (holes.length > 0) {
        const rowPlaceholders = holes.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = holes.flatMap((h) => [courseId, h.holeNum, 1, h.yards ?? null, h.par, h.hdcp, h.hdcp, SCORER_NAME]);
        await config_1.default.query(`INSERT INTO CourseDetails (CourseID, HoleNum, TeeID, Yards, Par, Hdcp, OrigHdcp, LastUpdateUser) VALUES ${rowPlaceholders}`, params);
    }
    return courseId;
}
/**
 * Get the course an event used in a given year. If that exact year has no course set (e.g. a
 * new year that hasn't been assigned one yet), falls back to the closest earlier year's course
 * — courses tend to carry over from year to year unless explicitly changed.
 */
async function getEventCourse(groupId, year) {
    const [rows] = await config_1.default.query(`SELECT rc.RyderYear, rc.CourseID, c.CourseName
     FROM RyderCourse rc
     INNER JOIN Course c ON c.CourseID = rc.CourseID
     WHERE rc.GroupID = ? AND rc.RyderYear <= ?
     ORDER BY rc.RyderYear DESC
     LIMIT 1`, [groupId, year]);
    if (rows.length === 0)
        return null;
    return { year: rows[0].RyderYear, courseId: rows[0].CourseID, courseName: rows[0].CourseName };
}
/**
 * Set (or change) the course an event uses for a specific year.
 */
async function setEventCourse(groupId, year, courseId) {
    await config_1.default.query(`INSERT INTO RyderCourse (GroupID, RyderYear, CourseID, LastUpdateUser)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE CourseID = ?, LastUpdateUser = ?`, [groupId, year, courseId, SCORER_NAME, courseId, SCORER_NAME]);
}
/**
 * Get every year an event has an explicitly recorded course, for the Course History screen.
 */
async function getEventCourseHistory(groupId) {
    const [rows] = await config_1.default.query(`SELECT rc.RyderYear, rc.CourseID, c.CourseName
     FROM RyderCourse rc
     INNER JOIN Course c ON c.CourseID = rc.CourseID
     WHERE rc.GroupID = ?
     ORDER BY rc.RyderYear DESC`, [groupId]);
    return rows.map((r) => ({ year: r.RyderYear, courseId: r.CourseID, courseName: r.CourseName }));
}
/**
 * Get every session an admin has explicitly set up for a year/group, in order — replaces the
 * old inferred-from-MatchID-arithmetic model entirely (see holeNumbersFor's doc comment for
 * why). `matchCount` is how many distinct matches exist in that session so far.
 */
async function getSessionsForYear(groupId, year) {
    const [rows] = await config_1.default.query(`SELECT rs.SessionID, rs.Name, rs.Type, rs.TeamSize, rs.Holes, rs.CourseID, c.CourseName,
       (SELECT COUNT(DISTINCT rm.MatchID) FROM RyderMatch rm
        WHERE rm.RyderYear = rs.RyderYear AND rm.GroupID = rs.GroupID AND rm.SessionID = rs.SessionID) AS matchCount
     FROM RyderSession rs
     LEFT JOIN Course c ON c.CourseID = rs.CourseID
     WHERE rs.GroupID = ? AND rs.RyderYear = ?
     ORDER BY rs.SessionID`, [groupId, year]);
    return rows.map((r) => ({
        sessionId: r.SessionID,
        name: r.Name,
        type: r.Type,
        teamSize: r.TeamSize,
        holes: r.Holes,
        courseId: r.CourseID,
        courseName: r.CourseName,
        matchCount: Number(r.matchCount),
    }));
}
/**
 * Create a new session for a year/group — SessionID is allocated as MAX(SessionID)+1 for
 * that year/group (starting at 1), same allocation pattern already used for RyderEvents'
 * GroupID and RyderMatch's MatchID. `teamSize` (players per side, 2-4) only means anything for
 * a Team session — stored as null for Individual. `courseId` is null unless this session is
 * played somewhere other than the event's default course for the year.
 */
async function createSession(groupId, year, name, type, holes, teamSize, courseId) {
    const [rows] = await config_1.default.query('SELECT COALESCE(MAX(SessionID), 0) + 1 AS nextId FROM RyderSession WHERE GroupID = ? AND RyderYear = ?', [groupId, year]);
    const sessionId = rows[0].nextId;
    const resolvedTeamSize = type === 'T' ? (teamSize ?? 2) : null;
    await config_1.default.query('INSERT INTO RyderSession (GroupID, RyderYear, SessionID, Name, Type, TeamSize, Holes, CourseID, LastUpdateUser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [groupId, year, sessionId, name, type, resolvedTeamSize, holes, courseId, SCORER_NAME]);
    let courseName = null;
    if (courseId !== null) {
        const [courseRows] = await config_1.default.query('SELECT CourseName FROM Course WHERE CourseID = ?', [courseId]);
        courseName = courseRows[0]?.CourseName ?? null;
    }
    return { sessionId, name, type, teamSize: resolvedTeamSize, holes, courseId, courseName, matchCount: 0 };
}
/**
 * Edit a session's name/type/holes/course in place — plans can change (e.g. going from team to
 * individual, renaming, or switching courses) even after matches already exist in it. Existing
 * matches keep their players/course; only the session's own definition changes.
 */
async function updateSession(groupId, year, sessionId, name, type, holes, teamSize, courseId) {
    const resolvedTeamSize = type === 'T' ? (teamSize ?? 2) : null;
    await config_1.default.query('UPDATE RyderSession SET Name = ?, Type = ?, TeamSize = ?, Holes = ?, CourseID = ?, LastUpdateUser = ? WHERE GroupID = ? AND RyderYear = ? AND SessionID = ?', [name, type, resolvedTeamSize, holes, courseId, SCORER_NAME, groupId, year, sessionId]);
}
/**
 * Delete a session and every match in it (plus that match's hole scores/results) — a session
 * created by mistake, or no longer wanted, shouldn't need its matches cleared out one at a
 * time first.
 */
async function deleteSession(groupId, year, sessionId) {
    const [matchRows] = await config_1.default.query('SELECT DISTINCT MatchID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?', [year, groupId, sessionId]);
    const matchIds = matchRows.map((r) => r.MatchID);
    if (matchIds.length > 0) {
        await config_1.default.query('DELETE FROM RyderMatchScore WHERE RyderYear = ? AND GroupID = ? AND MatchID IN (?)', [year, groupId, matchIds]);
        await config_1.default.query('DELETE FROM RyderMatchResults WHERE RyderYear = ? AND GroupID = ? AND MatchID IN (?)', [year, groupId, matchIds]);
        await config_1.default.query('DELETE FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?', [year, groupId, sessionId]);
    }
    await config_1.default.query('DELETE FROM RyderSession WHERE GroupID = ? AND RyderYear = ? AND SessionID = ?', [groupId, year, sessionId]);
}
/**
 * Get a year's Ryder Cup results — mirrors showresults.php, fixed to actually use the
 * requested year instead of showresults.php's hardcoded `RyderYear = 2025` (every query
 * in the original ignored the ryderyear URL param entirely).
 *
 * A match's Winner is 'B' (halved — both teams get its Points), 'U' (USA), or 'E' (Europe).
 * Team-level and session-level totals are summed directly from RyderMatchResults (one row
 * per match). Player-level points/records are computed separately from RyderMatch (one row
 * per player per match): a player earns the match's Points and a win if Winner equals their
 * own team, a tie (and the same Points) if Winner is 'B', otherwise a loss and no points —
 * including matches with no result row yet (not yet played), same as the original.
 */
async function getRyderResults(year, groupId = 1) {
    const [resultRows] = await config_1.default.query('SELECT MatchID, SessionID, Winner, Points FROM RyderMatchResults WHERE RyderYear = ? AND GroupID = ?', [year, groupId]);
    let usaPoints = 0;
    let euroPoints = 0;
    const sessionDefs = await getSessionsForYear(groupId, year);
    const sessionTotals = new Map();
    for (const s of sessionDefs)
        sessionTotals.set(s.sessionId, { name: s.name, usaPoints: 0, euroPoints: 0 });
    const resultByMatch = new Map();
    for (const r of resultRows) {
        const points = Number(r.Points);
        resultByMatch.set(r.MatchID, { sessionId: r.SessionID, winner: r.Winner, points });
        if (r.Winner === 'B' || r.Winner === 'U')
            usaPoints += points;
        if (r.Winner === 'B' || r.Winner === 'E')
            euroPoints += points;
        if (r.SessionID != null) {
            if (!sessionTotals.has(r.SessionID))
                sessionTotals.set(r.SessionID, { name: `Session ${r.SessionID}`, usaPoints: 0, euroPoints: 0 });
            const s = sessionTotals.get(r.SessionID);
            if (r.Winner === 'B' || r.Winner === 'U')
                s.usaPoints += points;
            if (r.Winner === 'B' || r.Winner === 'E')
                s.euroPoints += points;
        }
    }
    const [matchRows] = await config_1.default.query(`SELECT rm.MatchID, rm.PlayerID, rm.Team, CONCAT(rp.FirstName, ' ', rp.LastName) AS name
     FROM RyderMatch rm
     INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
     WHERE rm.RyderYear = ? AND rm.GroupID = ?
     ORDER BY rp.LastName, rp.FirstName`, [year, groupId]);
    const playerTotals = new Map();
    for (const m of matchRows) {
        if (!playerTotals.has(m.PlayerID)) {
            playerTotals.set(m.PlayerID, { name: m.name, team: m.Team, points: 0, wins: 0, losses: 0, ties: 0 });
        }
        const player = playerTotals.get(m.PlayerID);
        const result = resultByMatch.get(m.MatchID);
        if (!result)
            continue;
        if (result.winner === 'B') {
            player.points += result.points;
            player.ties += 1;
        }
        else if (result.winner === m.Team) {
            player.points += result.points;
            player.wins += 1;
        }
        else {
            player.losses += 1;
        }
    }
    const byPointsThenName = (a, b) => b.points - a.points || a.name.localeCompare(b.name);
    const stripTeam = ({ team: _team, ...rest }) => rest;
    const usaPlayers = Array.from(playerTotals.values()).filter((p) => p.team === 'U').map(stripTeam).sort(byPointsThenName);
    const euroPlayers = Array.from(playerTotals.values()).filter((p) => p.team === 'E').map(stripTeam).sort(byPointsThenName);
    const sessions = Array.from(sessionTotals.entries())
        .sort(([a], [b]) => a - b)
        .map(([sessionId, totals]) => ({ sessionId, ...totals }));
    return { usaPoints, euroPoints, sessions, usaPlayers, euroPlayers };
}
/**
 * Which holes a session's matches use, from its stored Holes setting ('F' front9, 'B' back9,
 * 'A' all 18) — an admin choice recorded on the session itself (see createSession), not
 * inferred. Pure function, no query needed.
 */
function holeNumbersFor(holes) {
    if (holes === 'B')
        return [10, 11, 12, 13, 14, 15, 16, 17, 18];
    if (holes === 'A')
        return Array.from({ length: 18 }, (_, i) => i + 1);
    return [1, 2, 3, 4, 5, 6, 7, 8, 9];
}
/**
 * Get a match's session — a direct read of RyderMatch.SessionID, which every match now
 * records explicitly at creation time (see saveMatchPairing). Returns null if the match
 * doesn't exist (or predates this column being populated).
 */
async function getMatchSessionId(year, groupId, matchId) {
    const [rows] = await config_1.default.query('SELECT DISTINCT SessionID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND MatchID = ?', [year, groupId, matchId]);
    return rows.length > 0 ? rows[0].SessionID : null;
}
/**
 * Build the matchId -> "USA roster" / "Euro roster" name strings for every match in a
 * year/group, joining multiple players on the same team/match with ' & ' (e.g. foursomes).
 * `includeHdcp` (Session Matches' list, via getSessionMatches) appends each player's current
 * one-decimal handicap in parentheses, e.g. "John Smith (12.3)" — off by default since
 * getRyderLeaderboard's in-progress-matches display doesn't want it.
 */
async function getMatchRosters(year, groupId, includeHdcp = false) {
    const [rows] = await config_1.default.query(includeHdcp
        ? `SELECT rm.MatchID, rm.Team, CONCAT(rp.FirstName, ' ', rp.LastName) AS name,
                COALESCE(h.HdcpIndex, h.Hdcp) AS hdcp
         FROM RyderMatch rm
         INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
         LEFT JOIN RyderHdcp h ON h.PlayerID = rm.PlayerID AND h.Year = (
           SELECT MAX(Year) FROM RyderHdcp WHERE PlayerID = rm.PlayerID
         )
         WHERE rm.RyderYear = ? AND rm.GroupID = ?
         ORDER BY rm.MatchID, rm.Team DESC, name`
        : `SELECT rm.MatchID, rm.Team, CONCAT(rp.FirstName, ' ', rp.LastName) AS name
         FROM RyderMatch rm
         INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
         WHERE rm.RyderYear = ? AND rm.GroupID = ?
         ORDER BY rm.MatchID, rm.Team DESC, name`, [year, groupId]);
    const rosters = new Map();
    for (const r of rows) {
        if (!rosters.has(r.MatchID))
            rosters.set(r.MatchID, { usaNames: [], euroNames: [] });
        const roster = rosters.get(r.MatchID);
        const label = includeHdcp && r.hdcp != null ? `${r.name} (${Number(r.hdcp).toFixed(1)})` : r.name;
        if (r.Team === 'U')
            roster.usaNames.push(label);
        else
            roster.euroNames.push(label);
    }
    const result = new Map();
    for (const [matchId, roster] of rosters) {
        result.set(matchId, { usaPlayers: roster.usaNames.join(' & '), euroPlayers: roster.euroNames.join(' & ') });
    }
    return result;
}
/**
 * Get one session's leaderboard for a Ryder Cup year/group — mirrors leaderboard.php's
 * AJAX drill-down (session standings, matches in progress, completed matches).
 */
async function getRyderLeaderboard(year, groupId, sessionId) {
    const [sessionRows] = await config_1.default.query('SELECT Name FROM RyderSession WHERE GroupID = ? AND RyderYear = ? AND SessionID = ?', [groupId, year, sessionId]);
    const sessionName = sessionRows[0]?.Name ?? `Session ${sessionId}`;
    const [pointsRows] = await config_1.default.query(`SELECT
       SUM(CASE WHEN Winner IN ('B', 'U') THEN Points ELSE 0 END) AS usaPoints,
       SUM(CASE WHEN Winner IN ('B', 'E') THEN Points ELSE 0 END) AS euroPoints
     FROM RyderMatchResults
     WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?`, [year, groupId, sessionId]);
    const usaPoints = Number(pointsRows[0]?.usaPoints ?? 0);
    const euroPoints = Number(pointsRows[0]?.euroPoints ?? 0);
    const rosters = await getMatchRosters(year, groupId);
    const [progressRows] = await config_1.default.query(`SELECT sc.MatchID, SUM(sc.Result) AS netResult, MAX(sc.HoleID) AS thru
     FROM RyderMatchScore sc
     WHERE sc.RyderYear = ? AND sc.GroupID = ?
     AND sc.MatchID IN (SELECT DISTINCT MatchID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?)
     AND sc.MatchID NOT IN (SELECT MatchID FROM RyderMatchResults WHERE RyderYear = ? AND GroupID = ?)
     GROUP BY sc.MatchID
     ORDER BY sc.MatchID`, [year, groupId, year, groupId, sessionId, year, groupId]);
    const inProgressMatches = progressRows.map((r) => {
        const netResult = Number(r.netResult);
        return {
            matchId: r.MatchID,
            ...(rosters.get(r.MatchID) ?? { usaPlayers: '', euroPlayers: '' }),
            leadingTeam: netResult > 0 ? 'U' : netResult < 0 ? 'E' : null,
            amount: Math.abs(netResult),
            thru: r.thru,
        };
    });
    const [completedRows] = await config_1.default.query(`SELECT MatchID, Winner, Result
     FROM RyderMatchResults
     WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?
     ORDER BY MatchID`, [year, groupId, sessionId]);
    const completedMatches = completedRows.map((r) => ({
        matchId: r.MatchID,
        ...(rosters.get(r.MatchID) ?? { usaPlayers: '', euroPlayers: '' }),
        winner: r.Winner,
        result: r.Result,
    }));
    return { sessionId, sessionName, usaPoints, euroPoints, inProgressMatches, completedMatches };
}
/**
 * Get a single match's scorecard — mirrors scorecard2.php.
 */
async function getRyderScorecard(year, groupId, matchId) {
    const [matchRows] = await config_1.default.query(`SELECT rm.Team, CONCAT(rp.FirstName, ' ', rp.LastName) AS name
     FROM RyderMatch rm
     INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
     WHERE rm.RyderYear = ? AND rm.GroupID = ? AND rm.MatchID = ?
     ORDER BY rm.Team DESC, name`, [year, groupId, matchId]);
    if (matchRows.length === 0)
        return null;
    const sessionId = (await getMatchSessionId(year, groupId, matchId)) ?? 1;
    const [sessionRows] = await config_1.default.query('SELECT Name, Holes FROM RyderSession WHERE GroupID = ? AND RyderYear = ? AND SessionID = ?', [groupId, year, sessionId]);
    const sessionName = sessionRows[0]?.Name ?? `Session ${sessionId}`;
    const holesSetting = (sessionRows[0]?.Holes ?? 'F');
    const [sessionMatchRows] = await config_1.default.query('SELECT DISTINCT MatchID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND SessionID = ? ORDER BY MatchID', [year, groupId, sessionId]);
    const sessionMatchIds = sessionMatchRows.map((r) => r.MatchID);
    const usaPlayers = matchRows.filter((r) => r.Team === 'U').map((r) => r.name).join(' & ');
    const euroPlayers = matchRows.filter((r) => r.Team === 'E').map((r) => r.name).join(' & ');
    const [scoreRows] = await config_1.default.query('SELECT HoleID, Result FROM RyderMatchScore WHERE RyderYear = ? AND GroupID = ? AND MatchID = ?', [year, groupId, matchId]);
    const resultByHole = new Map(scoreRows.map((r) => [r.HoleID, r.Result]));
    const winnerFor = (result) => {
        if (result === undefined)
            return null;
        if (result > 0)
            return 'U';
        if (result < 0)
            return 'E';
        return 'B';
    };
    const holes = holeNumbersFor(holesSetting).map((hole) => ({
        hole,
        winner: winnerFor(resultByHole.get(hole)),
    }));
    const [resultRows] = await config_1.default.query('SELECT Winner, Result FROM RyderMatchResults WHERE RyderYear = ? AND GroupID = ? AND MatchID = ?', [year, groupId, matchId]);
    const netResult = Array.from(resultByHole.values()).reduce((sum, r) => sum + r, 0);
    const thru = resultByHole.size === 0 ? 0 : Math.max(...resultByHole.keys());
    const leadingTeam = netResult > 0 ? 'U' : netResult < 0 ? 'E' : null;
    const amount = Math.abs(netResult);
    const completed = resultRows.length > 0;
    const winner = completed ? resultRows[0].Winner : null;
    const result = completed ? resultRows[0].Result : null;
    return {
        matchId,
        sessionId,
        sessionName,
        usaPlayers,
        euroPlayers,
        holes,
        completed,
        winner,
        result,
        leadingTeam,
        amount,
        thru,
        sessionMatchIds,
    };
}
/** Attribution recorded on writes, same purpose as the legacy pages' hardcoded scorer name. */
const SCORER_NAME = 'RyderCup App';
/** LastUpdateUser value ghinService's refreshGhinHandicaps writes to RyderHdcp — doubles as the
 * "where did this number come from" signal getLatestHdcp reads back (see its fromGhin field),
 * so a handicap screen can mark a manually-entered number differently from a GHIN-synced one. */
exports.GHIN_SYNC_USER = 'GHIN Sync';
/**
 * List every match in a session (regardless of completion) — mirrors start.php's match
 * picker, reached from the "Start Match" flow and from Session Matches' own list. Each
 * player's name carries their current one-decimal handicap in parentheses (see
 * getMatchRosters's includeHdcp).
 */
async function getSessionMatches(year, groupId, sessionId) {
    const [matchIdRows] = await config_1.default.query('SELECT DISTINCT MatchID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND SessionID = ? ORDER BY MatchID', [year, groupId, sessionId]);
    const matchIds = matchIdRows.map((r) => r.MatchID);
    if (matchIds.length === 0)
        return [];
    const rosters = await getMatchRosters(year, groupId, true);
    const [completedRows] = await config_1.default.query('SELECT MatchID FROM RyderMatchResults WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?', [year, groupId, sessionId]);
    const completedIds = new Set(completedRows.map((r) => r.MatchID));
    return matchIds.map((matchId) => ({
        matchId,
        ...(rosters.get(matchId) ?? { usaPlayers: '', euroPlayers: '' }),
        completed: completedIds.has(matchId),
    }));
}
/**
 * Get everything needed to run the live hole-by-hole scorer for a match — mirrors
 * rydermatch.php's initial data load (roster, par/handicap per hole, any scores already
 * recorded so a match already underway resumes where it left off).
 */
async function getMatchSetup(year, groupId, matchId) {
    const [matchRows] = await config_1.default.query(`SELECT rm.Team, CONCAT(rp.FirstName, ' ', rp.LastName) AS name
     FROM RyderMatch rm
     INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
     WHERE rm.RyderYear = ? AND rm.GroupID = ? AND rm.MatchID = ?
     ORDER BY rm.Team DESC, name`, [year, groupId, matchId]);
    if (matchRows.length === 0)
        return null;
    const sessionId = (await getMatchSessionId(year, groupId, matchId)) ?? 1;
    const [sessionRows] = await config_1.default.query('SELECT Holes FROM RyderSession WHERE GroupID = ? AND RyderYear = ? AND SessionID = ?', [groupId, year, sessionId]);
    const holesSetting = (sessionRows[0]?.Holes ?? 'F');
    const usaPlayers = matchRows.filter((r) => r.Team === 'U').map((r) => r.name).join(' & ');
    const euroPlayers = matchRows.filter((r) => r.Team === 'E').map((r) => r.name).join(' & ');
    const holeNumbers = holeNumbersFor(holesSetting);
    const eventCourse = await getEventCourse(groupId, year);
    const [courseRows] = await config_1.default.query('SELECT HoleNum, Par, OrigHdcp FROM CourseDetails WHERE CourseID = ? AND HoleNum IN (?)', [eventCourse?.courseId ?? 1, holeNumbers]);
    const courseByHole = new Map(courseRows.map((r) => [r.HoleNum, { par: r.Par, hdcp: r.OrigHdcp }]));
    const [scoreRows] = await config_1.default.query('SELECT HoleID, Result FROM RyderMatchScore WHERE RyderYear = ? AND GroupID = ? AND MatchID = ?', [year, groupId, matchId]);
    const resultByHole = new Map(scoreRows.map((r) => [r.HoleID, r.Result]));
    const winnerFor = (result) => {
        if (result === undefined)
            return null;
        if (result > 0)
            return 'U';
        if (result < 0)
            return 'E';
        return 'B';
    };
    const holes = holeNumbers.map((hole) => {
        const course = courseByHole.get(hole);
        return { hole, par: course?.par ?? 0, hdcp: course?.hdcp ?? 0, result: winnerFor(resultByHole.get(hole)) };
    });
    return { matchId, sessionId, usaPlayers, euroPlayers, holes };
}
/**
 * Record a single hole's result — mirrors savescore.php, parameterized (the original
 * concatenated the raw query-string values straight into SQL).
 */
async function saveHoleScore(year, groupId, matchId, holeId, result) {
    await config_1.default.query(`INSERT INTO RyderMatchScore (RyderYear, GroupID, MatchID, HoleID, Result, LastUpdateUser)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Result = ?`, [year, groupId, matchId, holeId, result, SCORER_NAME, result]);
}
/**
 * Record a match's final result — mirrors savematchres.php. matchScore is holes-up (positive
 * = USA, negative = Europe, 0 = halved) and holesRemaining is how many holes were left
 * unplayed when the match was decided (0 if it went the full nine). Unlike the original,
 * which re-derived the session from a third, differently-hardcoded MatchID range table, this
 * takes the session straight from RyderMatch.SessionID (via getMatchSetup).
 */
async function saveMatchResult(year, groupId, matchId, sessionId, matchScore, holesRemaining) {
    let winner;
    let points;
    let resultText;
    if (matchScore > 0) {
        winner = 'U';
        points = 1;
        resultText = `${matchScore} & ${holesRemaining}`;
    }
    else if (matchScore < 0) {
        winner = 'E';
        points = 1;
        resultText = `${Math.abs(matchScore)} & ${holesRemaining}`;
    }
    else {
        winner = 'B';
        points = 0.5;
        resultText = 'All Square';
    }
    await config_1.default.query(`INSERT INTO RyderMatchResults (RyderYear, GroupID, MatchID, SessionID, Winner, Points, Result, LastUpdateUser)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE SessionID = ?, Winner = ?, Points = ?, Result = ?`, [year, groupId, matchId, sessionId, winner, points, resultText, SCORER_NAME, sessionId, winner, points, resultText]);
}
/** Whether a player with this name already exists in this group (case-insensitive, trimmed) —
 * RyderPlayer has no DB-level unique constraint on (GroupID, FirstName, LastName), so this is
 * an application-level check, same idea as isEventNameTaken. */
async function isPlayerNameTaken(groupId, firstName, lastName) {
    const [rows] = await config_1.default.query('SELECT PlayerID FROM RyderPlayer WHERE GroupID = ? AND LOWER(FirstName) = LOWER(?) AND LOWER(LastName) = LOWER(?)', [groupId, firstName.trim(), lastName.trim()]);
    return rows.length > 0;
}
/**
 * Add a new player to the roster (Admin -> Add Players). The player's team affiliation is
 * a fixed roster attribute, same as setup.php's player dropdowns (filtered by Team and
 * Active='Y') expect — not something chosen per match. `team` is nullable (Team is a nullable
 * column) for a player whose team isn't determined yet — every existing team-filtered query
 * (leaderboard totals, match rosters, Setup's active-team toggles) already just excludes a row
 * whose Team doesn't equal 'U' or 'E', so a null team correctly shows up on neither team until
 * someone assigns one later. Rejects the add if a player with the same name already exists in
 * this group (same case-insensitive-name-collision pattern as createRyderEvent).
 */
async function addPlayer(groupId, firstName, lastName, team) {
    if (await isPlayerNameTaken(groupId, firstName, lastName)) {
        return { ok: false, error: `${firstName.trim()} ${lastName.trim()} is already on this event's roster.` };
    }
    await config_1.default.query(`INSERT INTO RyderPlayer (GroupID, FirstName, LastName, Team, Active, LastUpdateUser)
     VALUES (?, ?, ?, ?, 'Y', ?)`, [groupId, firstName, lastName, team, SCORER_NAME]);
    return { ok: true };
}
/**
 * Every player ever added to this group, sorted by last name then first name — for Add
 * Players' "already on this event" list. Deliberately lighter than getPlayerRoster (no
 * year-scoped played-last-year split, no per-player GHIN handicap lookups): this is just a
 * name/team reference list, not the Pick Players workflow.
 */
async function getPlayersForGroup(groupId) {
    const [rows] = await config_1.default.query('SELECT PlayerID, FirstName, LastName, Team FROM RyderPlayer WHERE GroupID = ? ORDER BY LastName, FirstName', [groupId]);
    return rows.map((r) => ({ playerId: r.PlayerID, firstName: r.FirstName, lastName: r.LastName, team: r.Team }));
}
/**
 * Get the full player roster for Admin -> Pick Players, split into "played last year" (whose
 * flag toggles default to how they're currently set, normally left over from that year) and
 * everyone else. Team/Active on RyderPlayer are current-state only — history is unaffected
 * because RyderMatch.Team captures each year's actual assignment independently (see
 * getRyderResults/getMatchRosters, which read RyderMatch.Team, never RyderPlayer.Team).
 */
async function getPlayerRoster(year, groupId) {
    const [yearRows] = await config_1.default.query('SELECT MAX(RyderYear) AS previousYear FROM RyderMatch WHERE RyderYear < ? AND GroupID = ?', [year, groupId]);
    const previousYear = yearRows[0]?.previousYear ?? null;
    const [playerRows] = await config_1.default.query('SELECT PlayerID, FirstName, LastName, Team, Active, Retired FROM RyderPlayer WHERE GroupID = ? ORDER BY LastName, FirstName', [groupId]);
    const players = await Promise.all(playerRows.map(async (r) => {
        const { hdcp, fromGhin } = await getLatestHdcp(r.PlayerID);
        return {
            playerId: r.PlayerID,
            firstName: r.FirstName,
            lastName: r.LastName,
            team: r.Team,
            active: r.Active === 'Y',
            retired: r.Retired === 'Y',
            hdcp,
            hdcpFromGhin: fromGhin,
        };
    }));
    let playedLastYearIds = new Set();
    if (previousYear !== null) {
        const [rows] = await config_1.default.query('SELECT DISTINCT PlayerID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ?', [previousYear, groupId]);
        playedLastYearIds = new Set(rows.map((r) => r.PlayerID));
    }
    const playedLastYear = players.filter((p) => playedLastYearIds.has(p.playerId));
    const others = players.filter((p) => !playedLastYearIds.has(p.playerId));
    return { previousYear, playedLastYear, others };
}
/**
 * Rename a player (Admin -> Setup roster pencil button) — fixes a typo or updates a legal
 * name. RyderPlayer has no unique constraint on (FirstName, LastName), so this doesn't check
 * for collisions; FirstName/LastName are part of the composite primary key, but PlayerID stays
 * fixed so this is a safe in-place rename, not a new row.
 */
async function renamePlayer(groupId, playerId, firstName, lastName) {
    await config_1.default.query(`UPDATE RyderPlayer SET FirstName = ?, LastName = ?, LastUpdateUser = ? WHERE PlayerID = ? AND GroupID = ?`, [firstName, lastName, SCORER_NAME, playerId, groupId]);
}
/**
 * Set a player's current team/active status (Course & Roster's flag toggles). Rejects the
 * change if this player already has match rows for `year` — once Setup Sessions has actually
 * paired them into a match, switching their team or taking them off the roster here would
 * silently disagree with what those matches already have on file (RyderMatch.Team isn't
 * touched by this, so the roster and the matches would show two different teams for the same
 * player). There's no way to reassign a player's team from Add/Edit Session (those only cover
 * name/type/holes/course) or from within a match, so the admin has to remove them from every
 * match they're currently in first — the error message says exactly that.
 */
async function updatePlayerStatus(groupId, playerId, active, team, year) {
    const [rows] = await config_1.default.query('SELECT COUNT(DISTINCT MatchID) AS c FROM RyderMatch WHERE GroupID = ? AND RyderYear = ? AND PlayerID = ?', [groupId, year, playerId]);
    if (Number(rows[0].c) > 0) {
        return {
            ok: false,
            error: `Cannot save — this player is already in a ${year} session/match. Delete them from all existing sessions first, then change their team here.`,
        };
    }
    await config_1.default.query(`UPDATE RyderPlayer SET Team = ?, Active = ?, LastUpdateUser = ? WHERE PlayerID = ? AND GroupID = ?`, [team, active ? 'Y' : 'N', SCORER_NAME, playerId, groupId]);
    return { ok: true };
}
/**
 * Mark a player as permanently retired (left the club, kicked out, deceased) or restore them —
 * separate from Active, which just tracks whether they're in the current year's playing pool.
 * Doesn't touch Team/Active, so restoring a retired player leaves their prior pool state intact.
 */
async function setPlayerRetired(groupId, playerId, retired) {
    await config_1.default.query(`UPDATE RyderPlayer SET Retired = ?, LastUpdateUser = ? WHERE PlayerID = ? AND GroupID = ?`, [retired ? 'Y' : 'N', SCORER_NAME, playerId, groupId]);
}
/**
 * Whether an admin has completed the prerequisite setup for a year/group — checked via
 * RyderMatch, not RyderRoster: RyderRoster is a brand-new table that's empty for every year,
 * including 2018-2025 (which have full real match/results data and obviously do work), so it
 * can't distinguish a working year from an empty one. RyderMatch existing is what actually
 * means Start Match/Leaderboard/Show Results have something to show. Once Setup Matches (the
 * match-pairing editor, see "Not yet ported" in the porting-status memory) exists, matches
 * only come to exist via completing rosters + running that setup, so this same check will
 * keep working without needing to change.
 */
async function isSetupDoneForYear(groupId, year) {
    const [rows] = await config_1.default.query('SELECT COUNT(*) AS c FROM RyderMatch WHERE GroupID = ? AND RyderYear = ?', [groupId, year]);
    return Number(rows[0].c) > 0;
}
/**
 * Whether a roster has been saved for a year/group — gates Setup Sessions specifically, as a
 * workflow order: the admin should finalize this year's official roster (RyderRoster) before
 * creating sessions/matches, rather than pairing players against whatever happens to be
 * currently marked Active on RyderPlayer. Distinct from isSetupDoneForYear, which checks
 * RyderMatch instead and gates the day-of-event screens (Start Match, Leaderboard, Show
 * Results) — Setup Sessions is exactly what creates RyderMatch rows, so it can't use that same
 * check without creating a lockout.
 */
async function isRosterSavedForYear(groupId, year) {
    const [rows] = await config_1.default.query('SELECT COUNT(*) AS c FROM RyderRoster WHERE GroupID = ? AND RyderYear = ?', [groupId, year]);
    return Number(rows[0].c) > 0;
}
/**
 * The actual saved roster for a year/group — Course & Roster's "Players" section reads this
 * (not RyderPlayer.Active/Team, which is the live/being-edited state) so it shows exactly what
 * was last confirmed via Save Roster, empty until that's happened at least once.
 */
async function getYearRoster(groupId, year) {
    const [rows] = await config_1.default.query('SELECT PlayerID, Team FROM RyderRoster WHERE GroupID = ? AND RyderYear = ?', [
        groupId,
        year,
    ]);
    return rows.map((r) => ({ playerId: r.PlayerID, team: r.Team }));
}
/**
 * Save the roster for a given year — a snapshot of which players (and on which team) are
 * playing this year, separate from RyderPlayer.Team/Active (current/default state) and from
 * RyderMatch.Team (locked in per-match once matches are actually set up). Re-saving a year
 * fully replaces its prior roster with whatever's currently active on the Setup screen, so
 * saving an unchanged roster (e.g. same players as last year) is a no-op in effect.
 */
async function saveYearRoster(groupId, year, players) {
    await config_1.default.query('DELETE FROM RyderRoster WHERE GroupID = ? AND RyderYear = ?', [groupId, year]);
    if (players.length > 0) {
        const rowPlaceholders = players.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const params = players.flatMap((p) => [groupId, year, p.playerId, p.team, SCORER_NAME]);
        await config_1.default.query(`INSERT INTO RyderRoster (GroupID, RyderYear, PlayerID, Team, LastUpdateUser) VALUES ${rowPlaceholders}`, params);
    }
}
/**
 * Get the active roster split by team, for Setup Matches' player dropdowns — mirrors
 * setup.php's "Team = 'U'/'E' And Active = 'Y'" player queries. Every player carries their
 * current handicap (see getLatestHdcp) so pairing/picker screens can show it inline.
 */
async function getActiveRosterForSetup(groupId) {
    const [rows] = await config_1.default.query(`SELECT PlayerID, Team, CONCAT(LastName, ', ', FirstName) AS name
     FROM RyderPlayer
     WHERE GroupID = ? AND Active = 'Y'
     ORDER BY LastName, FirstName`, [groupId]);
    const withHdcp = (list) => Promise.all(list.map(async (r) => {
        const { hdcp, fromGhin } = await getLatestHdcp(r.PlayerID);
        return { playerId: r.PlayerID, name: r.name, hdcp, hdcpFromGhin: fromGhin };
    }));
    const usaPlayers = await withHdcp(rows.filter((r) => r.Team === 'U'));
    const euroPlayers = await withHdcp(rows.filter((r) => r.Team === 'E'));
    return { usaPlayers, euroPlayers };
}
/**
 * Get the active roster players who aren't in any match yet created for a session — this is
 * "sitting out" for that session: not a tracked flag, just whoever the admin never assigned
 * to a match.
 */
async function getSittingOutForSession(groupId, year, sessionId) {
    const roster = await getActiveRosterForSetup(groupId);
    const [rows] = await config_1.default.query('SELECT DISTINCT PlayerID FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND SessionID = ?', [year, groupId, sessionId]);
    const playing = new Set(rows.map((r) => r.PlayerID));
    return {
        usaPlayers: roster.usaPlayers.filter((p) => !playing.has(p.playerId)),
        euroPlayers: roster.euroPlayers.filter((p) => !playing.has(p.playerId)),
    };
}
/**
 * Get a player's most recent recorded handicap, as a one-decimal index (e.g. 12.3) — mirrors
 * latest_hdcp.php. RyderHdcp isn't GroupID-scoped (handicaps are tracked per-player only), so
 * this doesn't take one. Shown while pairing players (to help pair similar handicaps) and
 * editable via saveHdcp — it's not saved as part of the match itself (see saveMatchPairing),
 * just tracked against the player. Falls back to the older whole-number Hdcp column for rows
 * saved before HdcpIndex started being populated.
 */
async function getLatestHdcp(playerId) {
    const [rows] = await config_1.default.query('SELECT HdcpIndex, Hdcp, LastUpdateUser FROM RyderHdcp WHERE PlayerID = ? ORDER BY Year DESC, LastUpdateDt DESC LIMIT 1', [playerId]);
    if (rows.length === 0)
        return { hdcp: null, fromGhin: false };
    const row = rows[0];
    const hdcp = row.HdcpIndex != null ? Number(row.HdcpIndex) : row.Hdcp;
    return { hdcp, fromGhin: row.LastUpdateUser === exports.GHIN_SYNC_USER };
}
/**
 * Record a player's handicap for a given year — upserts RyderHdcp(Year, PlayerID). This event
 * only runs once a year, but players often re-draft or get a new club handicap in the days
 * before it, so this is the "make sure everyone's number is current before the event" write
 * path (Admin -> Handicaps, and inline while picking players in the match pairing form — both
 * leave `updatedBy` at its default). Writes both the one-decimal HdcpIndex (what's actually
 * displayed) and the older whole-number Hdcp column, rounded, kept in sync in case anything
 * outside this app still reads it. ghinService's refreshGhinHandicaps is the only other caller,
 * passing GHIN_SYNC_USER so getLatestHdcp can tell a GHIN-synced number from a manual one.
 */
async function saveHdcp(playerId, year, hdcpIndex, updatedBy = SCORER_NAME) {
    await config_1.default.query(`INSERT INTO RyderHdcp (Year, PlayerID, Hdcp, HdcpIndex, LastUpdateUser) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE Hdcp = VALUES(Hdcp), HdcpIndex = VALUES(HdcpIndex), LastUpdateUser = VALUES(LastUpdateUser), LastUpdateDt = CURRENT_TIMESTAMP`, [year, playerId, Math.round(hdcpIndex), hdcpIndex, updatedBy]);
}
/**
 * Get whatever's currently assigned to a match (course + players), for Setup Matches' editor —
 * mirrors setup.php's initial load. Returns empty player arrays (and the event's current course
 * as a default) if the match hasn't been set up yet, rather than null, since Setup Matches always
 * has *some* match to show once a session is picked — there's no "not found" state to represent.
 */
async function getMatchPairing(year, groupId, matchId) {
    const sessionId = (await getMatchSessionId(year, groupId, matchId)) ?? 1;
    const [rows] = await config_1.default.query(`SELECT rm.CourseID, rm.Team, rm.PlayerID, CONCAT(rp.LastName, ', ', rp.FirstName) AS name
     FROM RyderMatch rm
     INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
     WHERE rm.RyderYear = ? AND rm.GroupID = ? AND rm.MatchID = ?
     ORDER BY rm.Team DESC, name`, [year, groupId, matchId]);
    const courseId = rows.length > 0 ? rows[0].CourseID : ((await getEventCourse(groupId, year))?.courseId ?? 1);
    const withHdcp = async (r) => {
        const { hdcp, fromGhin } = await getLatestHdcp(r.PlayerID);
        return { playerId: r.PlayerID, name: r.name, hdcp, hdcpFromGhin: fromGhin };
    };
    const usaPlayers = await Promise.all(rows.filter((r) => r.Team === 'U').map(withHdcp));
    const euroPlayers = await Promise.all(rows.filter((r) => r.Team === 'E').map(withHdcp));
    return { matchId, sessionId, courseId, usaPlayers, euroPlayers };
}
/**
 * Save a match's session + course + player pairings — mirrors savematch.php's
 * delete-then-reinsert (wipes this match's RyderMatch rows, then re-inserts one row per given
 * player), parameterized instead of the original's raw string-interpolated SQL, plus now
 * writes SessionID (the original never populated it — see getMatchSessionId's doc comment).
 * Doesn't touch Hdcp anywhere — see getLatestHdcp's doc comment, the original never
 * persisted it either.
 *
 * `matchId` is optional: omit it to create a brand-new match (allocates the next MatchID for
 * this year/group), or pass an existing one to replace that match's pairing in place. Returns
 * the match's id either way.
 */
async function saveMatchPairing(year, groupId, sessionId, courseId, players, matchId) {
    let resolvedMatchId = matchId;
    if (resolvedMatchId === undefined) {
        const [rows] = await config_1.default.query('SELECT COALESCE(MAX(MatchID), 0) + 1 AS nextId FROM RyderMatch WHERE RyderYear = ? AND GroupID = ?', [year, groupId]);
        resolvedMatchId = rows[0].nextId;
    }
    await config_1.default.query('DELETE FROM RyderMatch WHERE RyderYear = ? AND GroupID = ? AND MatchID = ?', [year, groupId, resolvedMatchId]);
    if (players.length > 0) {
        const rowPlaceholders = players.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = players.flatMap((p) => [year, groupId, resolvedMatchId, sessionId, courseId, p.playerId, p.team, SCORER_NAME]);
        await config_1.default.query(`INSERT INTO RyderMatch (RyderYear, GroupID, MatchID, SessionID, CourseID, PlayerID, Team, LastUpdateUser) VALUES ${rowPlaceholders}`, params);
    }
    return resolvedMatchId;
}
/**
 * Get every year's final standings — mirrors reshist.php, parameterized by group instead of
 * the original's hardcoded GroupID = 1.
 */
async function getResultsHistory(groupId) {
    const [rows] = await config_1.default.query(`SELECT RyderYear,
       SUM(CASE WHEN Winner IN ('U', 'B') THEN Points ELSE 0 END) AS usaPoints,
       SUM(CASE WHEN Winner IN ('E', 'B') THEN Points ELSE 0 END) AS euroPoints
     FROM RyderMatchResults
     WHERE GroupID = ?
     GROUP BY RyderYear
     ORDER BY RyderYear DESC`, [groupId]);
    return rows.map((r) => {
        const usaPoints = Number(r.usaPoints);
        const euroPoints = Number(r.euroPoints);
        return {
            year: r.RyderYear,
            usaPoints,
            euroPoints,
            winner: usaPoints > euroPoints ? 'U' : euroPoints > usaPoints ? 'E' : 'B',
        };
    });
}
/**
 * Get every player's all-time ranking — mirrors plyrrank.php's player ranking table, across
 * every year on record for the group. Reuses the same win/loss/tie logic as getRyderResults
 * (a player earns the match's points and a win if Winner equals their own team, a tie if
 * Winner is 'B', otherwise a loss — but only once a result exists; a not-yet-played match is
 * skipped rather than counted as a loss). The original SQL got this wrong: its LEFT JOIN
 * treated any match without a *winning* result row for that player — including ones with no
 * result at all yet — as a loss, which would undercount win% for anyone with unfinished
 * matches. MatchID resets to 1 each year, so matches are looked up by (year, matchId), not
 * matchId alone.
 */
async function getPlayerRanking(groupId) {
    const [resultRows] = await config_1.default.query('SELECT RyderYear, MatchID, Winner, Points FROM RyderMatchResults WHERE GroupID = ?', [groupId]);
    const resultByMatch = new Map();
    for (const r of resultRows) {
        resultByMatch.set(`${r.RyderYear}-${r.MatchID}`, { winner: r.Winner, points: Number(r.Points) });
    }
    const [matchRows] = await config_1.default.query(`SELECT rm.RyderYear, rm.MatchID, rm.PlayerID, rm.Team, CONCAT(rp.FirstName, ' ', rp.LastName) AS name
     FROM RyderMatch rm
     INNER JOIN RyderPlayer rp ON rp.PlayerID = rm.PlayerID
     WHERE rm.GroupID = ?`, [groupId]);
    const totals = new Map();
    for (const m of matchRows) {
        if (!totals.has(m.PlayerID))
            totals.set(m.PlayerID, { name: m.name, points: 0, wins: 0, losses: 0, ties: 0 });
        const player = totals.get(m.PlayerID);
        const result = resultByMatch.get(`${m.RyderYear}-${m.MatchID}`);
        if (!result)
            continue;
        if (result.winner === 'B') {
            player.points += result.points;
            player.ties += 1;
        }
        else if (result.winner === m.Team) {
            player.points += result.points;
            player.wins += 1;
        }
        else {
            player.losses += 1;
        }
    }
    return Array.from(totals.entries())
        .map(([playerId, p]) => {
        const decided = p.wins + p.losses + p.ties;
        const winPct = decided > 0 ? ((p.wins + 0.5 * p.ties) / decided) * 100 : 0;
        return { playerId, ...p, winPct };
    })
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
