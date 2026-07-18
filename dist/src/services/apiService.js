"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastGhinRefresh = exports.refreshGhinHandicaps = exports.getEasyGhinLinks = exports.linkPlayerGhin = exports.searchGhin = exports.setPlayerGhinSkip = exports.getGhinPlayerList = exports.getPlayerRanking = exports.getResultsHistory = exports.scanScorecard = exports.getGhinCourseDetail = exports.searchGhinCourses = exports.createCourse = exports.getEventCourseHistory = exports.setEventCourse = exports.getEventCourse = exports.getCourseList = exports.renameRyderEvent = exports.createRyderEvent = exports.getRyderEventById = exports.searchRyderEvents = exports.getYearRoster = exports.saveYearRoster = exports.setPlayerRetired = exports.updatePlayerStatus = exports.renamePlayer = exports.getPlayerRoster = exports.getPlayersForGroup = exports.addPlayer = exports.finalizeMatch = exports.saveHoleScore = exports.saveMatchPairing = exports.getMatchPairing = exports.saveHdcp = exports.getLatestHdcp = exports.getActiveRosterForSetup = exports.getSittingOutForSession = exports.deleteSession = exports.updateSession = exports.createSession = exports.getSessionsForYear = exports.getMatchSetup = exports.getSessionMatches = exports.getRyderScorecard = exports.getRyderLeaderboard = exports.getRyderResults = exports.getRosterStatus = exports.getSetupStatus = exports.getRyderGroups = exports.getRyderYears = void 0;
// Production API URL - always use this for built apps. To test a local backend change,
// temporarily point this at http://localhost:3000/api and revert before committing (see
// phoneAI's AGENTS.md for the same convention).
const API_URL = 'https://ryder-api.myclubgolf.com/api';
/**
 * Get every Ryder Cup year on record via the API server.
 */
const getRyderYears = async () => {
    try {
        const response = await fetch(`${API_URL}/ryder/years`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching Ryder years:', error);
        return [];
    }
};
exports.getRyderYears = getRyderYears;
/**
 * Get every Ryder Cup group on record, with its display name, via the API server.
 */
const getRyderGroups = async () => {
    try {
        const response = await fetch(`${API_URL}/ryder/groups`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching Ryder groups:', error);
        return [];
    }
};
exports.getRyderGroups = getRyderGroups;
/**
 * Whether an admin has completed setup (roster) for a year/group. Fails open (true) on a
 * network error so a transient fetch failure doesn't block a screen that would otherwise work.
 */
const getSetupStatus = async (year, groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/setup-status?year=${year}&group=${groupId}`);
        if (!response.ok)
            return true;
        const data = (await response.json());
        return data.setupDone;
    }
    catch (error) {
        console.error('Error checking Ryder setup status:', error);
        return true;
    }
};
exports.getSetupStatus = getSetupStatus;
/**
 * Whether a roster has been saved for a year/group — gates Setup Matches specifically. Fails
 * open (true) on a network error, same reasoning as getSetupStatus.
 */
const getRosterStatus = async (year, groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/roster-status?year=${year}&group=${groupId}`);
        if (!response.ok)
            return true;
        const data = (await response.json());
        return data.rosterSaved;
    }
    catch (error) {
        console.error('Error checking Ryder roster status:', error);
        return true;
    }
};
exports.getRosterStatus = getRosterStatus;
/**
 * Get a year's Ryder Cup results via the API server.
 */
const getRyderResults = async (year, groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/results?year=${year}&group=${groupId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching Ryder results:', error);
        return null;
    }
};
exports.getRyderResults = getRyderResults;
/**
 * Get one session's leaderboard via the API server.
 */
const getRyderLeaderboard = async (year, groupId, sessionId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/leaderboard?year=${year}&group=${groupId}&session=${sessionId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching Ryder leaderboard:', error);
        return null;
    }
};
exports.getRyderLeaderboard = getRyderLeaderboard;
/**
 * Get a single match's scorecard via the API server.
 */
const getRyderScorecard = async (year, groupId, matchId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/scorecard?year=${year}&group=${groupId}&match=${matchId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching Ryder scorecard:', error);
        return null;
    }
};
exports.getRyderScorecard = getRyderScorecard;
/**
 * Get every match in a session via the API server, for the Start Match match-picker screen.
 */
const getSessionMatches = async (year, groupId, sessionId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/session-matches?year=${year}&group=${groupId}&session=${sessionId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching session matches:', error);
        return [];
    }
};
exports.getSessionMatches = getSessionMatches;
/**
 * Get a match's live-scoring setup via the API server.
 */
const getMatchSetup = async (year, groupId, matchId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/match-setup?year=${year}&group=${groupId}&match=${matchId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching match setup:', error);
        return null;
    }
};
exports.getMatchSetup = getMatchSetup;
/**
 * Get every session defined for a year via the API server.
 */
const getSessionsForYear = async (year, groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/sessions?year=${year}&group=${groupId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching sessions:', error);
        return [];
    }
};
exports.getSessionsForYear = getSessionsForYear;
/**
 * Create a new session for a year via the API server (Setup Sessions -> Add Session).
 */
const createSession = async (year, groupId, name, type, holes, teamSize, courseId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, group: groupId, name, type, holes, teamSize, courseId }),
        });
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error creating session:', error);
        return null;
    }
};
exports.createSession = createSession;
/**
 * Edit a session's name/type/holes/course via the API server (Admin -> Setup Sessions pencil
 * icon).
 */
const updateSession = async (year, groupId, sessionId, name, type, holes, teamSize, courseId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/sessions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, group: groupId, session: sessionId, name, type, holes, teamSize, courseId }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error updating session:', error);
        return false;
    }
};
exports.updateSession = updateSession;
/**
 * Delete a session and every match in it via the API server (Admin -> Setup Sessions trash icon).
 */
const deleteSession = async (year, groupId, sessionId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/sessions`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, group: groupId, session: sessionId }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error deleting session:', error);
        return false;
    }
};
exports.deleteSession = deleteSession;
/**
 * Get the active roster players not yet in any match for a session via the API server, for
 * Session Matches' "Sitting out" display.
 */
const getSittingOutForSession = async (year, groupId, sessionId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/sitting-out?year=${year}&group=${groupId}&session=${sessionId}`);
        if (!response.ok)
            return { usaPlayers: [], euroPlayers: [] };
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching sitting-out players:', error);
        return { usaPlayers: [], euroPlayers: [] };
    }
};
exports.getSittingOutForSession = getSittingOutForSession;
/**
 * Get the active roster split by team via the API server, for Setup Matches' player dropdowns.
 */
const getActiveRosterForSetup = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/setup-roster?group=${groupId}`);
        if (!response.ok)
            return { usaPlayers: [], euroPlayers: [] };
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching setup roster:', error);
        return { usaPlayers: [], euroPlayers: [] };
    }
};
exports.getActiveRosterForSetup = getActiveRosterForSetup;
/**
 * Get a player's most recent recorded handicap via the API server.
 */
const getLatestHdcp = async (playerId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/latest-hdcp?player=${playerId}`);
        if (!response.ok)
            return { hdcp: null, fromGhin: false };
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching latest handicap:', error);
        return { hdcp: null, fromGhin: false };
    }
};
exports.getLatestHdcp = getLatestHdcp;
/**
 * Record a player's handicap for a year via the API server (Admin -> Handicaps, and inline
 * while picking players in the match pairing form).
 */
const saveHdcp = async (playerId, year, hdcp) => {
    try {
        const response = await fetch(`${API_URL}/ryder/hdcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, year, hdcp }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error saving handicap:', error);
        return false;
    }
};
exports.saveHdcp = saveHdcp;
/**
 * Get a match's current course/player pairing via the API server.
 */
const getMatchPairing = async (year, groupId, matchId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/match-pairing?year=${year}&group=${groupId}&match=${matchId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching match pairing:', error);
        return null;
    }
};
exports.getMatchPairing = getMatchPairing;
/**
 * Save a match's course/player pairing via the API server. Omit matchId to create a new
 * match in the session; the newly-allocated matchId is returned.
 */
const saveMatchPairing = async (year, groupId, sessionId, courseId, players, matchId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/match-pairing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, group: groupId, session: sessionId, match: matchId, courseId, players }),
        });
        if (!response.ok)
            return { ok: false };
        const data = (await response.json());
        return { ok: true, matchId: data.matchId };
    }
    catch (error) {
        console.error('Error saving match pairing:', error);
        return { ok: false };
    }
};
exports.saveMatchPairing = saveMatchPairing;
/**
 * Record a single hole's result via the API server. result is 1 (USA won the hole),
 * -1 (Europe won the hole), or 0 (halved).
 */
const saveHoleScore = async (year, groupId, matchId, hole, result) => {
    try {
        const response = await fetch(`${API_URL}/ryder/score-hole`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, group: groupId, match: matchId, hole, result }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error saving hole score:', error);
        return false;
    }
};
exports.saveHoleScore = saveHoleScore;
/**
 * Record a match's final result via the API server. matchScore is holes-up (positive = USA,
 * negative = Europe, 0 = halved) and holesRemaining is how many holes were left unplayed.
 */
const finalizeMatch = async (year, groupId, matchId, sessionId, matchScore, holesRemaining) => {
    try {
        const response = await fetch(`${API_URL}/ryder/finalize-match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, group: groupId, match: matchId, session: sessionId, matchScore, holesRemaining }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error finalizing match:', error);
        return false;
    }
};
exports.finalizeMatch = finalizeMatch;
/**
 * Add a new player to the roster via the API server. Returns an error message (e.g. a
 * same-named player already on this event's roster) instead of a bare boolean, so the UI can
 * show it inline.
 */
const addPlayer = async (groupId, firstName, lastName, team) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: groupId, firstName, lastName, team }),
        });
        if (response.ok)
            return { ok: true };
        const data = (await response.json().catch(() => ({})));
        return { ok: false, error: data.error ?? 'Failed to add player.' };
    }
    catch (error) {
        console.error('Error adding player:', error);
        return { ok: false, error: 'Failed to add player.' };
    }
};
exports.addPlayer = addPlayer;
/**
 * Get every player already added to this group, sorted by last name/first name, via the API
 * server — powers Add Players' "already on this event" list.
 */
const getPlayersForGroup = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players?group=${groupId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching players for group:', error);
        return [];
    }
};
exports.getPlayersForGroup = getPlayersForGroup;
/**
 * Get the player roster for Admin -> Pick Players via the API server.
 */
const getPlayerRoster = async (year, groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/player-roster?year=${year}&group=${groupId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching player roster:', error);
        return null;
    }
};
exports.getPlayerRoster = getPlayerRoster;
/**
 * Rename a player via the API server (Admin -> Setup roster pencil button).
 */
const renamePlayer = async (groupId, playerId, firstName, lastName) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players/${playerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: groupId, firstName, lastName }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error renaming player:', error);
        return false;
    }
};
exports.renamePlayer = renamePlayer;
/**
 * Set a player's current team/active status via the API server. Returns an error message
 * (e.g. the player is already in a session/match this year) instead of a bare boolean, so the
 * UI can show it inline.
 */
const updatePlayerStatus = async (groupId, playerId, active, team, year) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: groupId, playerId, active, team, year }),
        });
        if (response.ok)
            return { ok: true };
        const data = (await response.json().catch(() => ({})));
        return { ok: false, error: data.error ?? 'Failed to update player status.' };
    }
    catch (error) {
        console.error('Error updating player status:', error);
        return { ok: false, error: 'Failed to update player status.' };
    }
};
exports.updatePlayerStatus = updatePlayerStatus;
/**
 * Mark a player permanently retired (left the club, kicked out, deceased) or restore them, via
 * the API server. Separate from updatePlayerStatus — doesn't touch team/active.
 */
const setPlayerRetired = async (groupId, playerId, retired) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players/retired`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: groupId, playerId, retired }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error updating player retired status:', error);
        return false;
    }
};
exports.setPlayerRetired = setPlayerRetired;
/**
 * Save the roster for a year via the API server — replaces whichever players/teams were
 * previously saved for that year with the given list.
 */
const saveYearRoster = async (groupId, year, players) => {
    try {
        const response = await fetch(`${API_URL}/ryder/roster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: groupId, year, players }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error saving year roster:', error);
        return false;
    }
};
exports.saveYearRoster = saveYearRoster;
/**
 * Get the actual saved roster for a year via the API server — Course & Roster's "Players"
 * section reads this (empty until Save Roster has been used at least once for that year).
 */
const getYearRoster = async (groupId, year) => {
    try {
        const response = await fetch(`${API_URL}/ryder/year-roster?year=${year}&group=${groupId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching year roster:', error);
        return [];
    }
};
exports.getYearRoster = getYearRoster;
/**
 * Search Ryder Cup events by name or course via the API server. Empty query returns everything.
 */
const searchRyderEvents = async (query) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events?q=${encodeURIComponent(query)}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error searching Ryder events:', error);
        return [];
    }
};
exports.searchRyderEvents = searchRyderEvents;
/**
 * Get a single Ryder Cup event by GroupID via the API server.
 */
const getRyderEventById = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events/${groupId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching Ryder event:', error);
        return null;
    }
};
exports.getRyderEventById = getRyderEventById;
/**
 * Create a new Ryder Cup event via the API server. Returns an error message (e.g. name
 * already taken) instead of throwing, so the UI can show it inline.
 */
const createRyderEvent = async (eventName, courseId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventName, courseId }),
        });
        if (response.ok)
            return { ok: true, event: (await response.json()) };
        const data = (await response.json());
        return { ok: false, error: data.error ?? 'Failed to create event.' };
    }
    catch (error) {
        console.error('Error creating Ryder event:', error);
        return { ok: false, error: 'Failed to create event.' };
    }
};
exports.createRyderEvent = createRyderEvent;
/**
 * Rename an event via the API server. Returns an error message (e.g. name already taken)
 * instead of throwing, so the UI can show it inline next to the rename field.
 */
const renameRyderEvent = async (groupId, eventName) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events/${groupId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventName }),
        });
        if (response.ok)
            return { ok: true };
        const data = (await response.json());
        return { ok: false, error: data.error ?? 'Failed to rename event.' };
    }
    catch (error) {
        console.error('Error renaming Ryder event:', error);
        return { ok: false, error: 'Failed to rename event.' };
    }
};
exports.renameRyderEvent = renameRyderEvent;
/**
 * Get every course on record via the API server, for the Create Event course picker.
 */
const getCourseList = async () => {
    try {
        const response = await fetch(`${API_URL}/ryder/courses`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching course list:', error);
        return [];
    }
};
exports.getCourseList = getCourseList;
/**
 * Get the course an event used in a given year via the API server (falls back to the closest
 * earlier year's course if that exact year has none set).
 */
const getEventCourse = async (groupId, year) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events/${groupId}/course?year=${year}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching event course:', error);
        return null;
    }
};
exports.getEventCourse = getEventCourse;
/**
 * Set (or change) the course an event uses for a specific year via the API server.
 */
const setEventCourse = async (groupId, year, courseId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events/${groupId}/course`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, courseId }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error setting event course:', error);
        return false;
    }
};
exports.setEventCourse = setEventCourse;
/**
 * Get every year an event has an explicitly recorded course, via the API server.
 */
const getEventCourseHistory = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/events/${groupId}/course-history`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching event course history:', error);
        return [];
    }
};
exports.getEventCourseHistory = getEventCourseHistory;
/**
 * Create a brand-new course with its 18 hole rows. Returns the new CourseID, or null on failure.
 */
const createCourse = async (courseName, holes, ghinInfo) => {
    try {
        const response = await fetch(`${API_URL}/ryder/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName, holes, ghinInfo }),
        });
        if (!response.ok)
            return null;
        const data = (await response.json());
        return data.courseId;
    }
    catch (error) {
        console.error('Error creating course:', error);
        return null;
    }
};
exports.createCourse = createCourse;
/**
 * Search GHIN's course database by name (optionally scoped to a state), for Add Course's
 * "Search GHIN" flow.
 */
const searchGhinCourses = async (name, state) => {
    try {
        const params = new URLSearchParams({ name });
        if (state)
            params.set('state', state);
        const response = await fetch(`${API_URL}/ryder/ghin/course-search?${params.toString()}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error searching GHIN courses:', error);
        return [];
    }
};
exports.searchGhinCourses = searchGhinCourses;
/** Full tee-set/hole detail for one GHIN course, for Add Course's tee-set picker. */
const getGhinCourseDetail = async (courseId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/ghin/course-detail?courseId=${courseId}`);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching GHIN course detail:', error);
        return null;
    }
};
exports.getGhinCourseDetail = getGhinCourseDetail;
/**
 * Scan a photo of a golf scorecard and extract the course name plus each hole's
 * par and handicap, via the API server (Claude vision).
 */
const scanScorecard = async (imageBase64, mediaType) => {
    const response = await fetch(`${API_URL}/ryder/courses/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType }),
    });
    if (!response.ok) {
        const data = (await response.json().catch(() => ({})));
        throw new Error(data.error || 'Failed to scan scorecard');
    }
    return (await response.json());
};
exports.scanScorecard = scanScorecard;
/**
 * Get every year's final standings via the API server.
 */
const getResultsHistory = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/results-history?group=${groupId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching results history:', error);
        return [];
    }
};
exports.getResultsHistory = getResultsHistory;
/**
 * Get every player's all-time ranking via the API server.
 */
const getPlayerRanking = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/player-ranking?group=${groupId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching player ranking:', error);
        return [];
    }
};
exports.getPlayerRanking = getPlayerRanking;
/**
 * Get the GHIN-linking player list for a group via the API server.
 */
const getGhinPlayerList = async (groupId) => {
    try {
        const response = await fetch(`${API_URL}/ryder/ghin-players?group=${groupId}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching GHIN player list:', error);
        return [];
    }
};
exports.getGhinPlayerList = getGhinPlayerList;
/**
 * Skip (or un-skip) a player from the GHIN-linking flow.
 */
const setPlayerGhinSkip = async (playerId, skip) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players/${playerId}/ghin-skip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skip }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error setting GHIN skip:', error);
        return false;
    }
};
exports.setPlayerGhinSkip = setPlayerGhinSkip;
/**
 * Search the real GHIN Network for a golfer by name/state, to find their real GHIN number.
 */
const searchGhin = async (firstName, lastName, state, course = '') => {
    try {
        const response = await fetch(`${API_URL}/ryder/ghin/search?fname=${encodeURIComponent(firstName)}&lname=${encodeURIComponent(lastName)}&state=${encodeURIComponent(state)}&course=${encodeURIComponent(course)}`);
        if (!response.ok)
            return [];
        return (await response.json());
    }
    catch (error) {
        console.error('Error searching GHIN:', error);
        return [];
    }
};
exports.searchGhin = searchGhin;
/**
 * Link a player to a real GHIN number found via `searchGhin`.
 */
const linkPlayerGhin = async (playerId, ghin) => {
    try {
        const response = await fetch(`${API_URL}/ryder/players/${playerId}/ghin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ghin }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error linking GHIN:', error);
        return false;
    }
};
exports.linkPlayerGhin = linkPlayerGhin;
/**
 * Find unambiguous GHIN Network matches for every player on this group's roster with no GHIN
 * on file yet — can take upwards of 15-20 seconds for a full roster, so failures are rethrown
 * rather than swallowed to `[]`.
 */
const getEasyGhinLinks = async (groupId, year) => {
    const response = await fetch(`${API_URL}/ryder/ghin-easy-links?group=${groupId}&year=${year}`);
    if (!response.ok)
        throw new Error(`Server returned ${response.status}`);
    return (await response.json());
};
exports.getEasyGhinLinks = getEasyGhinLinks;
/**
 * Refreshes every GHIN-linked player's handicap from the live GHIN Network — called once when
 * the app launches (see app/_layout.tsx). The server no-ops (no GHIN API calls at all) for
 * anyone already refreshed today, so calling this on every app open is cheap by design. Pass
 * `force: true` (Course & Roster's "Refresh GHIN" button) to bypass that and re-pull everyone.
 */
const refreshGhinHandicaps = async (force = false) => {
    try {
        const response = await fetch(`${API_URL}/ryder/ghin/refresh-handicaps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: new Date().getFullYear(), force }),
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error refreshing GHIN handicaps:', error);
        return false;
    }
};
exports.refreshGhinHandicaps = refreshGhinHandicaps;
/**
 * When any player's handicap was last actually pulled from the live GHIN Network (as an ISO
 * datetime string), or null if it's never run. Shown on Course & Roster next to "Players".
 */
const getLastGhinRefresh = async () => {
    try {
        const response = await fetch(`${API_URL}/ryder/ghin/last-refresh`);
        if (!response.ok)
            return null;
        const data = (await response.json());
        return data.lastRefreshedAt;
    }
    catch (error) {
        console.error('Error fetching last GHIN refresh:', error);
        return null;
    }
};
exports.getLastGhinRefresh = getLastGhinRefresh;
