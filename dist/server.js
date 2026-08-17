"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
try {
    process.loadEnvFile();
}
catch {
    // .env is optional locally if vars are already set in the shell/host environment
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = __importDefault(require("./src/db/config"));
const ryderService_1 = require("./src/services/ryderService");
const ghinService_1 = require("./src/services/ghinService");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '15mb' }));
app.get('/api/ping', (_req, res) => {
    res.json({ status: 'ok' });
});
// Get every Ryder Cup year on record (mirrors ryderhome.php's year dropdown)
app.get('/api/ryder/years', async (_req, res) => {
    try {
        const years = await (0, ryderService_1.getRyderYears)();
        res.json(years);
    }
    catch (error) {
        console.error('Error fetching Ryder years:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder years' });
    }
});
// Get every Ryder Cup GroupID on record
app.get('/api/ryder/groups', async (_req, res) => {
    try {
        const groups = await (0, ryderService_1.getRyderGroups)();
        res.json(groups);
    }
    catch (error) {
        console.error('Error fetching Ryder groups:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder groups' });
    }
});
// Whether setup (roster) has been completed for a year/group — gates Start Match,
// Leaderboard, and Show Results on the client
app.get('/api/ryder/setup-status', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const setupDone = await (0, ryderService_1.isSetupDoneForYear)(groupId, year);
        res.json({ setupDone });
    }
    catch (error) {
        console.error('Error checking Ryder setup status:', error.message);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});
// Whether a roster has been saved for a year/group — gates Setup Matches specifically
app.get('/api/ryder/roster-status', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const rosterSaved = await (0, ryderService_1.isRosterSavedForYear)(groupId, year);
        res.json({ rosterSaved });
    }
    catch (error) {
        console.error('Error checking Ryder roster status:', error.message);
        res.status(500).json({ error: 'Failed to check roster status' });
    }
});
// Get a year's Ryder Cup results (standings, sessions, player points) endpoint
app.get('/api/ryder/results', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const results = await (0, ryderService_1.getRyderResults)(year, groupId);
        res.json(results);
    }
    catch (error) {
        console.error('Error fetching Ryder results:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder results' });
    }
});
// Get one session's leaderboard (session standings, matches in progress, completed matches)
app.get('/api/ryder/leaderboard', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const sessionId = parseInt(req.query.session);
        if (!year || !sessionId) {
            return res.status(400).json({ error: 'year and session query params are required' });
        }
        const leaderboard = await (0, ryderService_1.getRyderLeaderboard)(year, groupId, sessionId);
        res.json(leaderboard);
    }
    catch (error) {
        console.error('Error fetching Ryder leaderboard:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder leaderboard' });
    }
});
// Which team (if any) has clinched the Cup outright this year, and the specific match that
// did it -- see getRyderClinchInfo. Null when it hasn't been decided yet. KEPT for the frozen
// v1.0.5 app, which expects this exact (RyderClinchInfo | null) shape -- new clients use
// /clinch-status below instead.
app.get('/api/ryder/clinch', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const info = await (0, ryderService_1.getRyderClinchInfo)(year, groupId);
        res.json(info);
    }
    catch (error) {
        console.error('Error fetching Ryder clinch info:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder clinch info' });
    }
});
// Clinch STATUS for the every-30s poller (new clients): whether a clinch is even possible yet via
// a cheap COUNT gate (see getClinchStatus) plus the clinch payload once it happens -- lets the
// client back off to a slow poll during the early sessions when clinching is mathematically
// impossible. Separate from /clinch above so the frozen v1.0.5 app's contract stays intact.
app.get('/api/ryder/clinch-status', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const status = await (0, ryderService_1.getClinchStatus)(year, groupId);
        res.json(status);
    }
    catch (error) {
        console.error('Error fetching Ryder clinch status:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder clinch status' });
    }
});
// Running point totals over time (one entry per completed match, in recording order) plus the
// winning-line thresholds -- see getRyderPointsTimeline. Feeds the collapsible points-progression
// chart on Standings. Null when this year has no matches set up yet.
app.get('/api/ryder/points-timeline', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const timeline = await (0, ryderService_1.getRyderPointsTimeline)(year, groupId);
        res.json(timeline);
    }
    catch (error) {
        console.error('Error fetching Ryder points timeline:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder points timeline' });
    }
});
// Every completed match for the year, in recording order -- see getRyderCompletedMatches. Used
// client-side to detect matches finishing while someone's watching one of the live screens, for
// the per-match "Congratulations"/"Match Tied" celebration.
app.get('/api/ryder/completed-matches', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const matches = await (0, ryderService_1.getRyderCompletedMatches)(year, groupId);
        res.json(matches);
    }
    catch (error) {
        console.error('Error fetching Ryder completed matches:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder completed matches' });
    }
});
// Get a single match's hole-by-hole scorecard
app.get('/api/ryder/scorecard', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const matchId = parseInt(req.query.match);
        if (!year || !matchId) {
            return res.status(400).json({ error: 'year and match query params are required' });
        }
        const scorecard = await (0, ryderService_1.getRyderScorecard)(year, groupId, matchId);
        if (!scorecard) {
            return res.status(404).json({ error: 'Match not found' });
        }
        res.json(scorecard);
    }
    catch (error) {
        console.error('Error fetching Ryder scorecard:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder scorecard' });
    }
});
// List every match in a session (for the Start Match match-picker screen)
app.get('/api/ryder/session-matches', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const sessionId = parseInt(req.query.session);
        if (!year || !sessionId) {
            return res.status(400).json({ error: 'year and session query params are required' });
        }
        const matches = await (0, ryderService_1.getSessionMatches)(year, groupId, sessionId);
        res.json(matches);
    }
    catch (error) {
        console.error('Error fetching session matches:', error.message);
        res.status(500).json({ error: 'Failed to fetch session matches' });
    }
});
// Get everything needed to run the live hole-by-hole scorer for a match
app.get('/api/ryder/match-setup', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const matchId = parseInt(req.query.match);
        if (!year || !matchId) {
            return res.status(400).json({ error: 'year and match query params are required' });
        }
        const setup = await (0, ryderService_1.getMatchSetup)(year, groupId, matchId);
        if (!setup) {
            return res.status(404).json({ error: 'Match not found' });
        }
        res.json(setup);
    }
    catch (error) {
        console.error('Error fetching match setup:', error.message);
        res.status(500).json({ error: 'Failed to fetch match setup' });
    }
});
// Get every session set up for a year/group (Admin -> Setup Sessions list, plus every
// session picker elsewhere)
app.get('/api/ryder/sessions', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const sessions = await (0, ryderService_1.getSessionsForYear)(groupId, year);
        res.json(sessions);
    }
    catch (error) {
        console.error('Error fetching sessions:', error.message);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});
// Summary of the most recent prior year with sessions, for the "Copy sessions from previous
// year" shortcut (Admin -> Setup Sessions). Returns null when there's nothing to copy.
app.get('/api/ryder/sessions/previous', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const summary = await (0, ryderService_1.getPreviousSessionSummary)(groupId, year);
        res.json(summary);
    }
    catch (error) {
        console.error('Error fetching previous-session summary:', error.message);
        res.status(500).json({ error: 'Failed to fetch previous-session summary' });
    }
});
// Copy last year's session definitions into a year (Admin -> Setup Sessions "Copy sessions" callout)
app.post('/api/ryder/sessions/copy', async (req, res) => {
    try {
        const { year, group } = req.body;
        if (!year) {
            return res.status(400).json({ error: 'year is required' });
        }
        const sessions = await (0, ryderService_1.copyPreviousYearSessions)(group || 1, year);
        res.json(sessions);
    }
    catch (error) {
        console.error('Error copying sessions:', error.message);
        res.status(500).json({ error: error.message || 'Failed to copy sessions' });
    }
});
// Create a new session for a year/group (Admin -> Setup Sessions "+ Add Session")
app.post('/api/ryder/sessions', async (req, res) => {
    try {
        const { year, group, name, type, holes, teamSize, format, courseId } = req.body;
        if (!year || !name || (type !== 'T' && type !== 'I') || !['F', 'B', 'A'].includes(holes)) {
            return res.status(400).json({ error: 'year, name, type (T or I), and holes (F, B, or A) are required' });
        }
        if (teamSize !== undefined && teamSize !== null && ![2, 3, 4].includes(teamSize)) {
            return res.status(400).json({ error: 'teamSize must be 2, 3, or 4' });
        }
        if (format !== undefined && format !== null && !['B', 'A', 'O'].includes(format)) {
            return res.status(400).json({ error: 'format must be B (Better Ball), A (Alternate Shot), or O (Other)' });
        }
        const session = await (0, ryderService_1.createSession)(group || 1, year, name, type, holes, teamSize ?? null, format ?? null, courseId ?? null);
        res.json(session);
    }
    catch (error) {
        console.error('Error creating session:', error.message);
        res.status(500).json({ error: 'Failed to create session' });
    }
});
// Edit a session's name/type/holes/format (Admin -> Setup Sessions pencil icon)
app.put('/api/ryder/sessions', async (req, res) => {
    try {
        const { year, group, session, name, type, holes, teamSize, format, courseId } = req.body;
        if (!year || !session || !name || (type !== 'T' && type !== 'I') || !['F', 'B', 'A'].includes(holes)) {
            return res.status(400).json({ error: 'year, session, name, type (T or I), and holes (F, B, or A) are required' });
        }
        if (teamSize !== undefined && teamSize !== null && ![2, 3, 4].includes(teamSize)) {
            return res.status(400).json({ error: 'teamSize must be 2, 3, or 4' });
        }
        if (format !== undefined && format !== null && !['B', 'A', 'O'].includes(format)) {
            return res.status(400).json({ error: 'format must be B (Better Ball), A (Alternate Shot), or O (Other)' });
        }
        await (0, ryderService_1.updateSession)(group || 1, year, session, name, type, holes, teamSize ?? null, format ?? null, courseId ?? null);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error updating session:', error.message);
        res.status(500).json({ error: 'Failed to update session' });
    }
});
// Delete a session and every match in it (Admin -> Setup Sessions trash icon)
app.delete('/api/ryder/sessions', async (req, res) => {
    try {
        const { year, group, session } = req.body;
        if (!year || !session) {
            return res.status(400).json({ error: 'year and session are required' });
        }
        await (0, ryderService_1.deleteSession)(group || 1, year, session);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error deleting session:', error.message);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});
// Delete a single match (Session Matches "x" button)
app.delete('/api/ryder/matches', async (req, res) => {
    try {
        const { year, group, match } = req.body;
        if (!year || !match) {
            return res.status(400).json({ error: 'year and match are required' });
        }
        await (0, ryderService_1.deleteMatch)(group || 1, year, match);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error deleting match:', error.message);
        res.status(500).json({ error: 'Failed to delete match' });
    }
});
// Get the active roster players not yet in any match for a session (Session Matches' "Sitting out")
app.get('/api/ryder/sitting-out', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const sessionId = parseInt(req.query.session);
        if (!year || !sessionId) {
            return res.status(400).json({ error: 'year and session query params are required' });
        }
        const sittingOut = await (0, ryderService_1.getSittingOutForSession)(groupId, year, sessionId);
        res.json(sittingOut);
    }
    catch (error) {
        console.error('Error fetching sitting-out players:', error.message);
        res.status(500).json({ error: 'Failed to fetch sitting-out players' });
    }
});
// Get the active roster split by team (Admin -> Setup Matches player dropdowns)
app.get('/api/ryder/setup-roster', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year);
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const roster = await (0, ryderService_1.getActiveRosterForSetup)(year, groupId);
        res.json(roster);
    }
    catch (error) {
        console.error('Error fetching setup roster:', error.message);
        res.status(500).json({ error: 'Failed to fetch setup roster' });
    }
});
// Get a player's most recent recorded handicap (informational only, mirrors latest_hdcp.php)
app.get('/api/ryder/latest-hdcp', async (req, res) => {
    try {
        const playerId = parseInt(req.query.player);
        if (!playerId) {
            return res.status(400).json({ error: 'player query param is required' });
        }
        const result = await (0, ryderService_1.getLatestHdcp)(playerId);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching latest handicap:', error.message);
        res.status(500).json({ error: 'Failed to fetch latest handicap' });
    }
});
// Record a player's handicap for a year (Admin -> Handicaps, and inline in the match pairing form)
app.post('/api/ryder/hdcp', async (req, res) => {
    try {
        const { playerId, year, hdcp } = req.body;
        if (!playerId || !year || typeof hdcp !== 'number' || Number.isNaN(hdcp)) {
            return res.status(400).json({ error: 'playerId, year, and a numeric hdcp are required' });
        }
        await (0, ryderService_1.saveHdcp)(playerId, year, hdcp);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error saving handicap:', error.message);
        res.status(500).json({ error: 'Failed to save handicap' });
    }
});
// Whether this group's handicaps are frozen for a year (Captain -> Handicaps submenu)
app.get('/api/ryder/hdcp-freeze', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year);
        if (!year)
            return res.status(400).json({ error: 'year query param is required' });
        const status = await (0, ryderService_1.getHandicapFreezeStatus)(groupId, year);
        res.json(status);
    }
    catch (error) {
        console.error('Error fetching handicap freeze status:', error.message);
        res.status(500).json({ error: 'Failed to fetch handicap freeze status' });
    }
});
// Freeze this group's handicaps for a year -- GHIN sync will skip these players from now on
app.post('/api/ryder/hdcp-freeze', async (req, res) => {
    try {
        const { groupId, year, user } = req.body;
        if (!groupId || !year)
            return res.status(400).json({ error: 'groupId and year are required' });
        await (0, ryderService_1.freezeHandicaps)(groupId, year, user || 'app');
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error freezing handicaps:', error.message);
        res.status(500).json({ error: 'Failed to freeze handicaps' });
    }
});
// Unfreeze this group's handicaps for a year -- GHIN sync resumes normally
app.delete('/api/ryder/hdcp-freeze', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year);
        if (!year)
            return res.status(400).json({ error: 'year query param is required' });
        await (0, ryderService_1.unfreezeHandicaps)(groupId, year);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error unfreezing handicaps:', error.message);
        res.status(500).json({ error: 'Failed to unfreeze handicaps' });
    }
});
// Whether this group's year is marked cancelled (Captain -> Event Cancelled submenu)
app.get('/api/ryder/event-cancellation', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year);
        if (!year)
            return res.status(400).json({ error: 'year query param is required' });
        const status = await (0, ryderService_1.getEventCancellationStatus)(groupId, year);
        res.json(status);
    }
    catch (error) {
        console.error('Error fetching event cancellation status:', error.message);
        res.status(500).json({ error: 'Failed to fetch event cancellation status' });
    }
});
// Mark a year cancelled (e.g. rained out) -- Results History / Standings show Mother Nature as
// the winner instead of computing one from partial points. Underlying match data is untouched.
app.post('/api/ryder/event-cancellation', async (req, res) => {
    try {
        const { groupId, year, user } = req.body;
        if (!groupId || !year)
            return res.status(400).json({ error: 'groupId and year are required' });
        await (0, ryderService_1.cancelEvent)(groupId, year, user || 'app');
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error cancelling event:', error.message);
        res.status(500).json({ error: 'Failed to cancel event' });
    }
});
// Undo a cancellation (e.g. marked by mistake)
app.delete('/api/ryder/event-cancellation', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year);
        if (!year)
            return res.status(400).json({ error: 'year query param is required' });
        await (0, ryderService_1.uncancelEvent)(groupId, year);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error uncancelling event:', error.message);
        res.status(500).json({ error: 'Failed to uncancel event' });
    }
});
// Verify a candidate Captains password for one group (Menu -> Captains gate). Blank/never-set
// counts as "no password required" -- see verifyGroupCaptainPassword. Stateless: the client
// remembers "verified today" locally (see src/utils/captainAuth.ts), this endpoint just checks
// the candidate on each attempt.
app.post('/api/ryder/verify-captain-password', async (req, res) => {
    try {
        const { group, password } = req.body;
        if (!group) {
            return res.status(400).json({ error: 'group is required' });
        }
        const valid = await (0, ryderService_1.verifyGroupCaptainPassword)(group, password);
        res.json({ valid });
    }
    catch (error) {
        console.error('Error verifying captain password:', error.message);
        res.status(500).json({ error: 'Failed to verify captain password' });
    }
});
// Whether a group actually has a Captain password set -- menu.tsx checks this before ever
// showing the password prompt (blank means skip straight to setcaptainpassword.tsx instead).
// Not master-only; every group's own Captains gate needs this, not just Master Tools.
app.get('/api/ryder/captain-password-status', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group);
        if (!groupId) {
            return res.status(400).json({ error: 'group query param is required' });
        }
        res.json(await (0, ryderService_1.getGroupCaptainPasswordStatus)(groupId));
    }
    catch (error) {
        console.error('Error fetching captain password status:', error.message);
        res.status(500).json({ error: 'Failed to fetch captain password status' });
    }
});
// Master Tools only: the actual Captain password value (not just whether one is set), so a
// master user can remind a captain who forgot it without resetting it.
app.get('/api/ryder/master/captain-password', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group);
        if (!groupId) {
            return res.status(400).json({ error: 'group query param is required' });
        }
        res.json(await (0, ryderService_1.getGroupCaptainPasswordValue)(groupId));
    }
    catch (error) {
        console.error('Error fetching captain password value:', error.message);
        res.status(500).json({ error: 'Failed to fetch captain password value' });
    }
});
// Set (or clear, with password null) a group's Captain password -- used both by Master Tools'
// Change Group Password (any group) and setcaptainpassword.tsx (a group setting its own, right
// after being told it's currently blank).
app.post('/api/ryder/master/captain-password', async (req, res) => {
    try {
        const { group, password } = req.body;
        if (!group) {
            return res.status(400).json({ error: 'group is required' });
        }
        await (0, ryderService_1.setGroupCaptainPassword)(group, password === null || password === '' ? null : String(password));
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error setting captain password:', error.message);
        res.status(500).json({ error: 'Failed to set captain password' });
    }
});
// Master Tools only: every group in the system, unrestricted (including hidden ones)
app.get('/api/ryder/master/groups', async (req, res) => {
    try {
        const query = req.query.q || '';
        res.json(await (0, ryderService_1.searchAllGroupsForMaster)(query));
    }
    catch (error) {
        console.error('Error searching all groups:', error.message);
        res.status(500).json({ error: 'Failed to search all groups' });
    }
});
// Master Tools only: every group with a lifetime player/match count (Manage Events' list)
app.get('/api/ryder/master/groups-summary', async (_req, res) => {
    try {
        res.json(await (0, ryderService_1.getAllGroupsSummary)());
    }
    catch (error) {
        console.error('Error fetching groups summary:', error.message);
        res.status(500).json({ error: 'Failed to fetch groups summary' });
    }
});
// Master Tools only: permanently delete a group and everything under it. No undo.
app.delete('/api/ryder/master/groups/:groupId', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        if (!groupId) {
            return res.status(400).json({ error: 'A valid groupId is required' });
        }
        await (0, ryderService_1.deleteGroup)(groupId);
        res.json({ status: 'ok' });
    }
    catch (error) {
        if (error instanceof ryderService_1.ProtectedGroupError) {
            return res.status(403).json({ error: error.message });
        }
        console.error('Error deleting group:', error.message);
        res.status(500).json({ error: 'Failed to delete group' });
    }
});
// Get this event's Captain options (Captains -> Options) -- scoped per GroupID, not per year
app.get('/api/ryder/options', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const options = await (0, ryderService_1.getRyderOptions)(groupId);
        res.json(options);
    }
    catch (error) {
        console.error('Error fetching Ryder options:', error.message);
        res.status(500).json({ error: 'Failed to fetch options' });
    }
});
// Save this event's Captain options
app.post('/api/ryder/options', async (req, res) => {
    try {
        // womenHandicapHoles defaults to true when the request omits it -- so an older client that
        // doesn't know the field can't silently turn women's handicap holes off on save.
        const { groupId, handicapsEnabled, keepScoreEnabled, altShotLowPct, altShotHighPct, nineHoleHalfStrokes, womenHandicapHoles = true, teamBFlag = 'euro', } = req.body;
        if (!groupId)
            return res.status(400).json({ error: 'groupId is required' });
        const lowPct = altShotLowPct ?? 60;
        const highPct = altShotHighPct ?? 40;
        if (!Number.isInteger(lowPct) || !Number.isInteger(highPct) || lowPct < 0 || highPct < 0 || lowPct + highPct !== 100) {
            return res.status(400).json({ error: 'altShotLowPct and altShotHighPct must be whole numbers that sum to 100' });
        }
        if (teamBFlag !== 'euro' && teamBFlag !== 'jester') {
            return res.status(400).json({ error: "teamBFlag must be 'euro' or 'jester'" });
        }
        await (0, ryderService_1.saveRyderOptions)(groupId, {
            handicapsEnabled: !!handicapsEnabled,
            keepScoreEnabled: !!keepScoreEnabled,
            bestBallLowestHandicap: true,
            altShotLowPct: lowPct,
            altShotHighPct: highPct,
            nineHoleHalfStrokes: !!nineHoleHalfStrokes,
            womenHandicapHoles: !!womenHandicapHoles,
            teamBFlag,
        });
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error saving Ryder options:', error.message);
        res.status(500).json({ error: 'Failed to save options' });
    }
});
// Get a match's current course/player pairing (Admin -> Setup Matches editor)
app.get('/api/ryder/match-pairing', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const matchId = parseInt(req.query.match);
        if (!year || !matchId) {
            return res.status(400).json({ error: 'year and match query params are required' });
        }
        const pairing = await (0, ryderService_1.getMatchPairing)(year, groupId, matchId);
        res.json(pairing);
    }
    catch (error) {
        console.error('Error fetching match pairing:', error.message);
        res.status(500).json({ error: 'Failed to fetch match pairing' });
    }
});
// Save a match's session/course/player pairing (Admin -> Setup Sessions match form). Omit
// `match` to create a new match in the session; pass it to replace an existing match's pairing.
app.post('/api/ryder/match-pairing', async (req, res) => {
    try {
        const { year, group, session, match, courseId, players } = req.body;
        if (!year || !session || !courseId || !Array.isArray(players)) {
            return res.status(400).json({ error: 'year, session, courseId, and players (array) are required' });
        }
        const matchId = await (0, ryderService_1.saveMatchPairing)(year, group || 1, session, courseId, players, match || undefined);
        res.json({ status: 'ok', matchId });
    }
    catch (error) {
        console.error('Error saving match pairing:', error.message);
        res.status(500).json({ error: 'Failed to save match pairing' });
    }
});
// Get a match's players and their teebox picks so far (live scorer's tee-picker gate)
app.get('/api/ryder/match-tees', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const matchId = parseInt(req.query.match);
        if (!year || !matchId) {
            return res.status(400).json({ error: 'year and match query params are required' });
        }
        const tees = await (0, ryderService_1.getMatchPlayerTees)(year, groupId, matchId);
        res.json(tees);
    }
    catch (error) {
        console.error('Error fetching match tees:', error.message);
        res.status(500).json({ error: 'Failed to fetch match tees' });
    }
});
// Record one player's teebox pick for a match
app.post('/api/ryder/match-tees', async (req, res) => {
    try {
        const { year, group, match, playerId, ghinTeeSetId, teeName, courseHandicap, user } = req.body;
        // ghinTeeSetId is intentionally checked with === undefined, not truthiness -- 0 is the real,
        // valid sentinel matchtees.tsx sends for a manually-entered handicap (no real GHIN tee).
        if (!year || !match || !playerId || ghinTeeSetId === undefined || !teeName || courseHandicap === undefined) {
            return res.status(400).json({ error: 'year, match, playerId, ghinTeeSetId, teeName, and courseHandicap are required' });
        }
        await (0, ryderService_1.saveMatchPlayerTee)(year, group || 1, match, playerId, ghinTeeSetId, teeName, courseHandicap, user || 'app');
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error saving match tee:', error.message);
        res.status(500).json({ error: 'Failed to save match tee' });
    }
});
// Which other match (if any) this one is paired with as one foursome (Singles only)
app.get('/api/ryder/match-link', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const matchId = parseInt(req.query.match);
        if (!year || !matchId) {
            return res.status(400).json({ error: 'year and match query params are required' });
        }
        const linkedMatchId = await (0, ryderService_1.getMatchLink)(year, groupId, matchId);
        res.json({ linkedMatchId });
    }
    catch (error) {
        console.error('Error fetching match link:', error.message);
        res.status(500).json({ error: 'Failed to fetch match link' });
    }
});
// Pair two Singles matches as one foursome (replaces either match's existing link, if any)
app.post('/api/ryder/match-link', async (req, res) => {
    try {
        const { year, group, matchId, linkedMatchId, user } = req.body;
        if (!year || !matchId || !linkedMatchId) {
            return res.status(400).json({ error: 'year, matchId, and linkedMatchId are required' });
        }
        await (0, ryderService_1.saveMatchLink)(year, group || 1, matchId, linkedMatchId, user || 'app');
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error saving match link:', error.message);
        res.status(500).json({ error: 'Failed to save match link' });
    }
});
// Unpair a match from whichever other match it's currently linked with
app.post('/api/ryder/match-link/unlink', async (req, res) => {
    try {
        const { year, group, matchId } = req.body;
        if (!year || !matchId) {
            return res.status(400).json({ error: 'year and matchId are required' });
        }
        await (0, ryderService_1.unlinkMatch)(year, group || 1, matchId);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error unlinking match:', error.message);
        res.status(500).json({ error: 'Failed to unlink match' });
    }
});
// Get every player's already-entered gross score for one hole (Keep Score mode)
app.get('/api/ryder/match-hole-scores', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        const matchId = parseInt(req.query.match);
        const holeId = parseInt(req.query.hole);
        if (!year || !matchId || !holeId) {
            return res.status(400).json({ error: 'year, match, and hole query params are required' });
        }
        const scores = await (0, ryderService_1.getMatchHoleScores)(year, groupId, matchId, holeId);
        res.json(scores);
    }
    catch (error) {
        console.error('Error fetching match hole scores:', error.message);
        res.status(500).json({ error: 'Failed to fetch match hole scores' });
    }
});
// Save every player's gross score for one hole in one go (Keep Score mode)
app.post('/api/ryder/match-hole-scores', async (req, res) => {
    try {
        const { year, group, match, hole, scores, user } = req.body;
        if (!year || !match || !hole || !Array.isArray(scores) || scores.length === 0) {
            return res.status(400).json({ error: 'year, match, hole, and a non-empty scores array are required' });
        }
        await (0, ryderService_1.saveMatchHoleScores)(year, group || 1, match, hole, scores, user || 'app');
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error saving match hole scores:', error.message);
        res.status(500).json({ error: 'Failed to save match hole scores' });
    }
});
// Record a single hole's result
app.post('/api/ryder/score-hole', async (req, res) => {
    try {
        const { year, group, match, hole, result } = req.body;
        if (!year || !match || !hole || result === undefined) {
            return res.status(400).json({ error: 'year, match, hole, and result are required' });
        }
        await (0, ryderService_1.saveHoleScore)(year, group || 1, match, hole, result);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error saving hole score:', error.message);
        res.status(500).json({ error: 'Failed to save hole score' });
    }
});
// Clear a single hole's result and (if Keep Score was used) its raw per-player scores -- the
// Finalize modal's "Cancel" option, for when the deciding hole was actually scored wrong
app.post('/api/ryder/clear-hole-score', async (req, res) => {
    try {
        const { year, group, match, hole } = req.body;
        if (!year || !match || !hole) {
            return res.status(400).json({ error: 'year, match, and hole are required' });
        }
        await (0, ryderService_1.clearHoleScore)(year, group || 1, match, hole);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error clearing hole score:', error.message);
        res.status(500).json({ error: 'Failed to clear hole score' });
    }
});
// Whether anything is actually live this year -- used to decide whether Leaderboard/Standings
// should even start their 30s auto-refresh, rather than polling year-round for an event that
// only runs one day a year
app.get('/api/ryder/live-activity', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const live = await (0, ryderService_1.hasLiveActivity)(groupId, year);
        res.json({ live });
    }
    catch (error) {
        console.error('Error checking live activity:', error.message);
        res.status(500).json({ error: 'Failed to check live activity' });
    }
});
// Mark a match's scorer screen as opened (Start Match tapped, nothing recorded yet)
app.post('/api/ryder/matches/opened', async (req, res) => {
    try {
        const { year, group, match } = req.body;
        if (!year || !match) {
            return res.status(400).json({ error: 'year and match are required' });
        }
        await (0, ryderService_1.markMatchOpened)(group || 1, year, match);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error marking match opened:', error.message);
        res.status(500).json({ error: 'Failed to mark match opened' });
    }
});
// Clear a match's "opened" marker (left the scorer screen without recording anything)
app.delete('/api/ryder/matches/opened', async (req, res) => {
    try {
        const { year, group, match } = req.body;
        if (!year || !match) {
            return res.status(400).json({ error: 'year and match are required' });
        }
        await (0, ryderService_1.clearMatchOpened)(group || 1, year, match);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error clearing match opened:', error.message);
        res.status(500).json({ error: 'Failed to clear match opened' });
    }
});
// Record a match's final result
app.post('/api/ryder/finalize-match', async (req, res) => {
    try {
        const { year, group, match, session, matchScore, holesRemaining } = req.body;
        if (!year || !match || !session || matchScore === undefined || holesRemaining === undefined) {
            return res.status(400).json({ error: 'year, match, session, matchScore, and holesRemaining are required' });
        }
        await (0, ryderService_1.saveMatchResult)(year, group || 1, match, session, matchScore, holesRemaining);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error finalizing match:', error.message);
        res.status(500).json({ error: 'Failed to finalize match' });
    }
});
// Un-finalize a match -- a correction to an earlier hole made it no longer actually decided
app.post('/api/ryder/unfinalize-match', async (req, res) => {
    try {
        const { year, group, match } = req.body;
        if (!year || !match) {
            return res.status(400).json({ error: 'year and match are required' });
        }
        await (0, ryderService_1.unfinalizeMatch)(year, group || 1, match);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error unfinalizing match:', error.message);
        res.status(500).json({ error: 'Failed to unfinalize match' });
    }
});
// Add a new player to the roster (Admin -> Add Players)
app.post('/api/ryder/players', async (req, res) => {
    try {
        const { group, year, firstName, lastName, team, state, email, phone, gender } = req.body;
        if (!year || !firstName || !lastName || (team !== 'U' && team !== 'E')) {
            return res.status(400).json({ error: 'year, firstName, lastName, and team (U or E) are required' });
        }
        const result = await (0, ryderService_1.addPlayer)(group || 1, year, firstName.trim(), lastName.trim(), team, {
            state: state ? String(state).trim().toUpperCase() : null,
            email: email ? String(email).trim() : null,
            phone: phone ? String(phone).trim() : null,
            gender: gender === 'F' ? 'F' : 'M',
        });
        if (!result.ok) {
            return res.status(409).json({ error: result.error });
        }
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error adding player:', error.message);
        res.status(500).json({ error: 'Failed to add player' });
    }
});
// Every player on this group's roster, sorted by last name/first name (Admin -> Add Players list)
app.get('/api/ryder/players', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year);
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const players = await (0, ryderService_1.getPlayersForGroup)(groupId, year);
        res.json(players);
    }
    catch (error) {
        console.error('Error fetching players for group:', error.message);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});
// Get the full player roster, split into "played last year" and everyone else (Admin -> Pick Players)
app.get('/api/ryder/player-roster', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        const groupId = parseInt(req.query.group || '1');
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const roster = await (0, ryderService_1.getPlayerRoster)(year, groupId);
        res.json(roster);
    }
    catch (error) {
        console.error('Error fetching player roster:', error.message);
        res.status(500).json({ error: 'Failed to fetch player roster' });
    }
});
// Update a player's name and contact details (Admin -> Setup roster pencil button)
app.patch('/api/ryder/players/:id', async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        const { group, firstName, lastName, state, email, phone, gender } = req.body;
        if (!firstName?.trim() || !lastName?.trim()) {
            return res.status(400).json({ error: 'firstName and lastName are required' });
        }
        await (0, ryderService_1.updatePlayerDetails)(group || 1, playerId, firstName.trim(), lastName.trim(), {
            state: state ? String(state).trim().toUpperCase() : null,
            email: email ? String(email).trim() : null,
            phone: phone ? String(phone).trim() : null,
            gender: gender === 'F' ? 'F' : 'M',
        });
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error updating player:', error.message);
        res.status(500).json({ error: 'Failed to update player' });
    }
});
// Add or remove a player from a year's roster (Admin -> Setup flag toggles)
app.post('/api/ryder/players/status', async (req, res) => {
    try {
        const { group, year, playerId, active, team } = req.body;
        if (!year || !playerId || typeof active !== 'boolean' || (team !== 'U' && team !== 'E')) {
            return res.status(400).json({ error: 'year, playerId, active (boolean), and team (U or E) are required' });
        }
        await (0, ryderService_1.setRosterMembership)(group || 1, year, playerId, active, team);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error updating roster membership:', error.message);
        res.status(500).json({ error: 'Failed to update roster membership' });
    }
});
// Mark a player permanently retired (left club/deceased/kicked out) or restore them (Admin -> Setup)
app.post('/api/ryder/players/retired', async (req, res) => {
    try {
        const { group, playerId, retired } = req.body;
        if (!playerId || typeof retired !== 'boolean') {
            return res.status(400).json({ error: 'playerId and retired (boolean) are required' });
        }
        await (0, ryderService_1.setPlayerRetired)(group || 1, playerId, retired);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error updating player retired status:', error.message);
        res.status(500).json({ error: 'Failed to update player retired status' });
    }
});
// Maintenance: move an entire year's data to a different RyderYear within a group (see
// renameEventYear's doc comment -- reusing a test event for successive real-year "replay" runs).
// Not wired into the app UI -- deliberately admin/curl-only, since it's destructive and rare.
app.post('/api/ryder/admin/rename-year', async (req, res) => {
    try {
        const { group, fromYear, toYear } = req.body;
        if (!group || !fromYear || !toYear) {
            return res.status(400).json({ error: 'group, fromYear, and toYear are required' });
        }
        const result = await (0, ryderService_1.renameEventYear)(Number(group), Number(fromYear), Number(toYear));
        if (!result.ok)
            return res.status(400).json(result);
        res.json(result);
    }
    catch (error) {
        console.error('Error renaming event year:', error.message);
        res.status(500).json({ error: 'Failed to rename event year' });
    }
});
// Maintenance: permanently delete a year's data within a group (see clearEventYear's doc
// comment). Not wired into the app UI -- deliberately admin/curl-only, since it's destructive.
app.post('/api/ryder/admin/clear-year', async (req, res) => {
    try {
        const { group, year } = req.body;
        if (!group || !year) {
            return res.status(400).json({ error: 'group and year are required' });
        }
        await (0, ryderService_1.clearEventYear)(Number(group), Number(year));
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Error clearing event year:', error.message);
        res.status(500).json({ error: 'Failed to clear event year' });
    }
});
// Search Ryder Cup events by name or course (empty query returns everything)
app.get('/api/ryder/events', async (req, res) => {
    try {
        const query = req.query.q || '';
        const events = await (0, ryderService_1.searchRyderEvents)(query);
        res.json(events);
    }
    catch (error) {
        console.error('Error searching Ryder events:', error.message);
        res.status(500).json({ error: 'Failed to search Ryder events' });
    }
});
// Get a single Ryder Cup event by GroupID
app.get('/api/ryder/events/:groupId', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const event = await (0, ryderService_1.getRyderEventById)(groupId);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    }
    catch (error) {
        console.error('Error fetching Ryder event:', error.message);
        res.status(500).json({ error: 'Failed to fetch Ryder event' });
    }
});
// Create a new Ryder Cup event, rejecting the name if it's already taken
app.post('/api/ryder/events', async (req, res) => {
    try {
        const { eventName, courseId } = req.body;
        if (!eventName || !courseId) {
            return res.status(400).json({ error: 'eventName and courseId are required' });
        }
        const result = await (0, ryderService_1.createRyderEvent)(eventName, courseId);
        if (!result.ok) {
            return res.status(409).json({ error: result.error });
        }
        res.json(result.event);
    }
    catch (error) {
        console.error('Error creating Ryder event:', error.message);
        res.status(500).json({ error: 'Failed to create Ryder event' });
    }
});
// Rename an event (Admin -> Setup), rejecting the change if the name is already taken
app.patch('/api/ryder/events/:groupId', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { eventName } = req.body;
        if (!eventName) {
            return res.status(400).json({ error: 'eventName is required' });
        }
        const result = await (0, ryderService_1.renameRyderEvent)(groupId, eventName);
        if (!result.ok) {
            return res.status(409).json({ error: result.error });
        }
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error renaming Ryder event:', error.message);
        res.status(500).json({ error: 'Failed to rename Ryder event' });
    }
});
// Get every year's final standings (Menu -> History -> Results History)
app.get('/api/ryder/results-history', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const history = await (0, ryderService_1.getResultsHistory)(groupId);
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching results history:', error.message);
        res.status(500).json({ error: 'Failed to fetch results history' });
    }
});
// Get every player's all-time ranking (Menu -> History -> Player Rank)
app.get('/api/ryder/player-ranking', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const ranking = await (0, ryderService_1.getPlayerRanking)(groupId);
        res.json(ranking);
    }
    catch (error) {
        console.error('Error fetching player ranking:', error.message);
        res.status(500).json({ error: 'Failed to fetch player ranking' });
    }
});
// Get every all-time partnership record (Menu -> History -> Teams History)
app.get('/api/ryder/teams-history', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const history = await (0, ryderService_1.getTeamsHistory)(groupId);
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching teams history:', error.message);
        res.status(500).json({ error: 'Failed to fetch teams history' });
    }
});
// Get every all-time singles head-to-head record (Menu -> History -> Singles History)
app.get('/api/ryder/singles-history', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const history = await (0, ryderService_1.getSinglesHistory)(groupId);
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching singles history:', error.message);
        res.status(500).json({ error: 'Failed to fetch singles history' });
    }
});
// Get every course on record, for the Create Event course picker
app.get('/api/ryder/courses', async (_req, res) => {
    try {
        const courses = await (0, ryderService_1.getCourseList)();
        res.json(courses);
    }
    catch (error) {
        console.error('Error fetching course list:', error.message);
        res.status(500).json({ error: 'Failed to fetch course list' });
    }
});
// Get the course an event used in a given year (falls back to the closest earlier year's course)
app.get('/api/ryder/events/:groupId/course', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const year = parseInt(req.query.year);
        if (!year) {
            return res.status(400).json({ error: 'year query param is required' });
        }
        const course = await (0, ryderService_1.getEventCourse)(groupId, year);
        res.json(course);
    }
    catch (error) {
        console.error('Error fetching event course:', error.message);
        res.status(500).json({ error: 'Failed to fetch event course' });
    }
});
// Set (or change) the course an event uses for a specific year
app.post('/api/ryder/events/:groupId/course', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { year, courseId } = req.body;
        if (!year || !courseId) {
            return res.status(400).json({ error: 'year and courseId are required' });
        }
        await (0, ryderService_1.setEventCourse)(groupId, year, courseId);
        res.json({ status: 'ok' });
    }
    catch (error) {
        console.error('Error setting event course:', error.message);
        res.status(500).json({ error: 'Failed to set event course' });
    }
});
// Get every year an event has an explicitly recorded course
app.get('/api/ryder/events/:groupId/course-history', async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const history = await (0, ryderService_1.getEventCourseHistory)(groupId);
        res.json(history);
    }
    catch (error) {
        console.error('Error fetching event course history:', error.message);
        res.status(500).json({ error: 'Failed to fetch event course history' });
    }
});
// Create a brand-new course with its 18 hole rows
app.post('/api/ryder/courses', async (req, res) => {
    try {
        const { courseName, holes, ghinInfo, ghinTeeSets } = req.body;
        if (!courseName || !Array.isArray(holes)) {
            return res.status(400).json({ error: 'courseName and holes are required' });
        }
        const courseId = await (0, ryderService_1.createCourse)(courseName, holes, ghinInfo);
        if (Array.isArray(ghinTeeSets) && ghinTeeSets.length > 0) {
            await (0, ghinService_1.saveCourseTeeSets)(courseId, ghinTeeSets);
        }
        res.json({ courseId });
    }
    catch (error) {
        console.error('Error creating course:', error.message);
        res.status(500).json({ error: 'Failed to create course' });
    }
});
// Search GHIN's own course database (CRDB) by name, for Add Course's "Search GHIN" flow
app.get('/api/ryder/ghin/course-search', async (req, res) => {
    try {
        const name = (req.query.name || '').trim();
        const state = (req.query.state || '').trim();
        if (!name) {
            return res.status(400).json({ error: 'name query param is required' });
        }
        const results = await (0, ghinService_1.searchGhinCourses)(name, state);
        res.json(results);
    }
    catch (error) {
        console.error('Error searching GHIN courses:', error.message);
        res.status(500).json({ error: 'Failed to search GHIN courses' });
    }
});
// Full tee-set/hole detail (par, yardage, stroke index, ratings) for one GHIN course
app.get('/api/ryder/ghin/course-detail', async (req, res) => {
    try {
        const courseId = parseInt(req.query.courseId);
        if (!courseId) {
            return res.status(400).json({ error: 'courseId query param is required' });
        }
        const detail = await (0, ghinService_1.getGhinCourseDetail)(courseId);
        if (!detail) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json(detail);
    }
    catch (error) {
        console.error('Error fetching GHIN course detail:', error.message);
        res.status(500).json({ error: 'Failed to fetch GHIN course detail' });
    }
});
// A player's current handicap index + Course Handicap per tee at a course (match-start tee picker)
app.get('/api/ryder/players/:id/course-handicaps', async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        const courseId = parseInt(req.query.courseId);
        if (!courseId) {
            return res.status(400).json({ error: 'courseId query param is required' });
        }
        const result = await (0, ghinService_1.getPlayerCourseHandicaps)(playerId, courseId);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching player course handicaps:', error.message);
        res.status(500).json({ error: 'Failed to fetch course handicaps' });
    }
});
// Get the GHIN-linking player list for a group
app.get('/api/ryder/ghin-players', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const rows = await (0, ghinService_1.getGhinPlayerList)(groupId);
        res.json(rows);
    }
    catch (error) {
        console.error('Error fetching GHIN player list:', error.message);
        res.status(500).json({ error: 'Failed to fetch GHIN player list' });
    }
});
// Skip (or un-skip) a player from the GHIN-linking flow
app.post('/api/ryder/players/:id/ghin-skip', async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        const { skip } = req.body;
        await (0, ghinService_1.setPlayerGhinSkip)(playerId, !!skip);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error setting GHIN skip:', error.message);
        res.status(500).json({ error: 'Failed to set GHIN skip' });
    }
});
// Search the real GHIN Network by name/state, with a nationwide "posted at our course" fallback
app.get('/api/ryder/ghin/search', async (req, res) => {
    try {
        const fname = req.query.fname || '';
        const lname = req.query.lname || '';
        const state = req.query.state || '';
        const course = req.query.course || '';
        const results = await (0, ghinService_1.searchGhinWithHistoryFallback)(fname, lname, state, course);
        res.json(results);
    }
    catch (error) {
        console.error('Error searching GHIN:', error.message);
        res.status(500).json({ error: 'Failed to search GHIN' });
    }
});
// Find unambiguous GHIN Network matches for every player on this group's roster with no GHIN
app.get('/api/ryder/ghin-easy-links', async (req, res) => {
    try {
        const groupId = parseInt(req.query.group || '1');
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const candidates = await (0, ghinService_1.findEasyGhinLinks)(groupId, year);
        res.json(candidates);
    }
    catch (error) {
        console.error('Error finding easy GHIN links:', error.message);
        res.status(500).json({ error: 'Failed to find easy GHIN links' });
    }
});
// Link a player to a real GHIN number
app.post('/api/ryder/players/:id/ghin', async (req, res) => {
    try {
        const playerId = parseInt(req.params.id);
        const { ghin } = req.body;
        if (!ghin) {
            return res.status(400).json({ error: 'ghin is required' });
        }
        await (0, ghinService_1.linkPlayerGhin)(playerId, Number(ghin));
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error linking GHIN:', error.message);
        res.status(500).json({ error: 'Failed to link GHIN' });
    }
});
// Refresh every GHIN-linked player's handicap from the live GHIN Network — called once when the
// app launches (app/_layout.tsx); no-ops (no network calls) for anyone already refreshed today,
// see refreshGhinHandicaps's doc comment. `force: true` (Course & Roster's "Refresh GHIN"
// button) skips that same-day guard and re-pulls everyone.
app.post('/api/ryder/ghin/refresh-handicaps', async (req, res) => {
    try {
        const year = parseInt(req.body?.year) || new Date().getFullYear();
        await (0, ghinService_1.refreshGhinHandicaps)(year, !!req.body?.force);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error refreshing GHIN handicaps:', error.message);
        res.status(500).json({ error: 'Failed to refresh GHIN handicaps' });
    }
});
// Refresh every GHIN-linked course's cached tee sets from GHIN — called monthly by cron (see
// refreshAllCourseTeeSets's doc comment for why monthly, not on every lookup).
app.post('/api/ryder/ghin/refresh-course-tee-sets', async (_req, res) => {
    try {
        const result = await (0, ghinService_1.refreshAllCourseTeeSets)();
        res.json({ success: true, ...result });
    }
    catch (error) {
        console.error('Error refreshing course tee sets:', error.message);
        res.status(500).json({ error: 'Failed to refresh course tee sets' });
    }
});
// When any player's handicap was last actually pulled from the live GHIN Network (Course &
// Roster's "GHIN refreshed <date/time>" next to Players)
app.get('/api/ryder/ghin/last-refresh', async (_req, res) => {
    try {
        const lastRefreshedAt = await (0, ghinService_1.getLastGhinRefresh)();
        res.json({ lastRefreshedAt });
    }
    catch (error) {
        console.error('Error fetching last GHIN refresh:', error.message);
        res.status(500).json({ error: 'Failed to fetch last GHIN refresh' });
    }
});
// Database connectivity test endpoint
app.get('/api/db-test', async (_req, res) => {
    try {
        const [rows] = await config_1.default.query('SELECT VERSION() AS version');
        res.json({ status: 'connected', database: rows[0], timestamp: new Date().toISOString() });
    }
    catch (error) {
        console.error('Database connection failed:', error.message);
        res.status(503).json({
            status: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`API server running on http://0.0.0.0:${PORT} [${env}]`);
});
