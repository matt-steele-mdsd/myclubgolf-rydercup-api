"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGhinPlayerList = getGhinPlayerList;
exports.setPlayerGhinSkip = setPlayerGhinSkip;
exports.linkPlayerGhin = linkPlayerGhin;
exports.getGhinBearerToken = getGhinBearerToken;
exports.searchGhinGolfers = searchGhinGolfers;
exports.searchGhinWithHistoryFallback = searchGhinWithHistoryFallback;
exports.findEasyGhinLinks = findEasyGhinLinks;
exports.refreshGhinHandicaps = refreshGhinHandicaps;
exports.getLastGhinRefresh = getLastGhinRefresh;
exports.searchGhinCourses = searchGhinCourses;
exports.getGhinCourseDetail = getGhinCourseDetail;
const config_1 = __importDefault(require("../db/config"));
const ryderService_1 = require("./ryderService");
/** Every player on this group's roster, eligible for GHIN linking. */
async function getGhinPlayerList(groupId) {
    const [rows] = await config_1.default.query(`SELECT PlayerID, CONCAT(LastName, ',', FirstName) AS name, GHIN, SkipGhin, State
     FROM RyderPlayer
     WHERE GroupID = ?
     ORDER BY LastName, FirstName`, [groupId]);
    return rows.map((r) => ({
        playerId: r.PlayerID,
        name: r.name,
        ghin: r.GHIN,
        skipped: r.SkipGhin === 'Y',
        state: r.State,
    }));
}
/** Skip (or un-skip) a player from the GHIN-linking flow. */
async function setPlayerGhinSkip(playerId, skip) {
    await config_1.default.query('UPDATE RyderPlayer SET SkipGhin = ? WHERE PlayerID = ?', [skip ? 'Y' : 'N', playerId]);
}
/**
 * Link a player to a real GHIN number found via `searchGhinGolfers` (Player List's manual
 * search, or Check Easy Links' one-tap link), and immediately pull their current index in too —
 * otherwise a freshly-linked player's handicap would sit blank/stale until the next scheduled
 * refresh (see refreshGhinHandicaps). The link itself still succeeds even if this lookup fails
 * (e.g. GHIN's API is briefly down); it just falls back to the normal daily refresh.
 */
async function linkPlayerGhin(playerId, ghin) {
    await config_1.default.query('UPDATE RyderPlayer SET GHIN = ? WHERE PlayerID = ?', [ghin, playerId]);
    try {
        const token = await getGhinBearerToken();
        const index = await getGolferIndex(ghin, token);
        if (index !== null) {
            await (0, ryderService_1.saveHdcp)(playerId, new Date().getFullYear(), index, ryderService_1.GHIN_SYNC_USER);
        }
    }
    catch (error) {
        console.error(`Error syncing handicap for newly-linked GHIN ${ghin} (player ${playerId}):`, error.message);
    }
}
// The site's own GHIN.com login, used only to authenticate to the GHIN Network API on golfers'
// behalf — same account phoneAI's ghinService.ts uses.
const GHIN_LOGIN_NUMBER = '4240722';
const GHIN_LOGIN_PASSWORD = 'Ohiostate1';
// Reused across calls within this window instead of logging in fresh every time — linkPlayerGhin
// used to call getGhinBearerToken() on every single link, which during a bulk Check Easy Links
// session (one login per player, back-to-back) was enough to get the shared GHIN account
// rate-limited (403 Forbidden on the login endpoint itself, 2026-07-11). 20 minutes is well
// under GHIN's own session lifetime.
let cachedToken = null;
const TOKEN_CACHE_MS = 20 * 60 * 1000;
async function getGhinBearerToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.token;
    }
    const response = await fetch('https://ghin-apiproxy.usga.org/api/v1/golfer_login.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
        body: JSON.stringify({
            user: { email_or_ghin: GHIN_LOGIN_NUMBER, password: GHIN_LOGIN_PASSWORD, remember_me: 'true' },
            token: 'nonblank',
        }),
    });
    if (!response.ok) {
        throw new Error(`GHIN login failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json());
    const token = data.golfer_user.golfer_user_token;
    cachedToken = { token, expiresAt: Date.now() + TOKEN_CACHE_MS };
    return token;
}
// Exact current index by GHIN number (not inferred from score history) — same lookup as
// phoneAI's getGolferIndex, GHIN's own site uses this endpoint too.
async function getGolferIndex(ghin, token) {
    const url = `https://ghin-apiproxy.usga.org/api/v1/golfers/search.json?golfer_id=${ghin}&per_page=1&page=1`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
        return null;
    const data = (await response.json());
    const golfer = (data.golfers ?? [])[0];
    if (!golfer)
        return null;
    const index = Number(golfer.hi_value ?? golfer.handicap_index);
    return Number.isNaN(index) ? null : index;
}
/**
 * Search the real GHIN Network for golfers by name (and optionally state). Requires logging
 * into the GHIN API with the site's own GHIN account first to get a bearer token, then
 * searching on the golfer's behalf.
 *
 * GHIN's search requires either a `state` or a `country` — a blank/falsy `state` here searches
 * `country=USA` instead, covering every state in one request. `country=USA` triples up every
 * result for some reason, so exact-duplicate entries (same GHIN *and* same club) are deduped.
 */
async function searchGhinGolfers(firstName, lastName, state, token) {
    const authToken = token ?? (await getGhinBearerToken());
    const locationParam = state ? `state=${encodeURIComponent(state)}` : 'country=USA';
    // api2.ghin.com matches first_name as a PREFIX (first_name=R finds "Richard"), unlike
    // ghin-apiproxy.usga.org/golfers/search.json which requires an exact first-name match.
    const url = `https://api2.ghin.com/api/v1/golfers.json?status=Active&from_ghin=true&per_page=50&sorting_criteria=full_name&order=asc&page=1&source=GHINcom&last_name=${encodeURIComponent(lastName)}&first_name=${encodeURIComponent(firstName)}&${locationParam}`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok)
        return [];
    const data = (await response.json());
    const golfers = data.golfers ?? [];
    const seenKeys = new Set();
    const results = [];
    for (const g of golfers) {
        const ghin = Number(g.ghin);
        const key = `${ghin}|${g.club_name}`;
        if (seenKeys.has(key))
            continue;
        seenKeys.add(key);
        results.push({
            name: `${g.first_name} ${g.last_name}`,
            club: g.club_name,
            state: g.state,
            handicapIndex: g.handicap_index,
            status: g.status,
            ghin,
        });
    }
    return results;
}
function normalizeForCompare(value) {
    return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// A search is "easy" (unambiguous) only if we can confirm the match actually belongs to our own
// course — a name search runs nationwide, so a single result is not by itself safe. When a
// confirmed GHIN club name is on file for our course, require an exact match against it, no
// matter how many total results came back. Otherwise fall back to the weaker heuristic of
// trusting a lone nationwide result or fuzzy-matching our own course name against GHIN's.
function pickEasyMatch(results, course, ghinClubName) {
    if (ghinClubName) {
        const normalizedTarget = normalizeForCompare(ghinClubName);
        const clubMatches = results.filter((r) => normalizeForCompare(r.club) === normalizedTarget);
        return clubMatches.length === 1 ? clubMatches[0] : null;
    }
    if (results.length === 1)
        return results[0];
    if (results.length > 1 && course) {
        const normalizedCourse = normalizeForCompare(course);
        const courseMatches = results.filter((r) => {
            const normalizedClub = normalizeForCompare(r.club);
            return normalizedClub && (normalizedClub.includes(normalizedCourse) || normalizedCourse.includes(normalizedClub));
        });
        if (courseMatches.length === 1)
            return courseMatches[0];
    }
    return null;
}
// Common English nickname/formal-name groups — GHIN's own name search is an exact match on
// first name (no prefix/fuzzy matching), so a player stored as "Matt" is invisible to GHIN if
// their real GHIN account is registered as "Matthew". Same list phoneAI's ghinService.ts uses.
const NICKNAME_GROUPS = [
    ['matt', 'matthew'],
    ['mike', 'michael', 'mikey'],
    ['dave', 'david', 'davey'],
    ['tom', 'thomas', 'tommy'],
    ['jim', 'james', 'jimmy'],
    ['bill', 'william', 'billy', 'will', 'willy'],
    ['bob', 'robert', 'bobby', 'rob', 'robbie'],
    ['rick', 'richard', 'ricky', 'dick'],
    ['nick', 'nicholas', 'nicky'],
    ['chris', 'christopher'],
    ['steve', 'steven', 'stephen'],
    ['dan', 'daniel', 'danny'],
    ['ken', 'kenneth', 'kenny'],
    ['greg', 'gregory'],
    ['jeff', 'jeffrey'],
    ['joe', 'joseph', 'joey'],
    ['ed', 'edward', 'eddie', 'ted', 'teddy'],
    ['andy', 'andrew', 'drew'],
    ['al', 'albert', 'alan', 'allen'],
    ['alex', 'alexander'],
    ['sam', 'samuel', 'sammy'],
    ['pat', 'patrick'],
    ['frank', 'francis', 'franklin'],
    ['ron', 'ronald', 'ronnie'],
    ['larry', 'lawrence'],
    ['ben', 'benjamin', 'benny'],
    ['charlie', 'charles', 'chuck'],
    ['tony', 'anthony'],
    ['vince', 'vincent'],
    ['phil', 'philip'],
    ['zach', 'zachary', 'zack'],
    ['nate', 'nathan', 'nathaniel'],
    ['josh', 'joshua'],
    ['jon', 'jonathan', 'johnny'],
    ['tim', 'timothy', 'timmy'],
    ['wes', 'wesley'],
    ['doug', 'douglas'],
    ['russ', 'russell'],
    ['stan', 'stanley'],
    ['walt', 'walter'],
    ['fred', 'frederick', 'freddy'],
    ['gene', 'eugene'],
    ['marty', 'martin'],
    ['pete', 'peter'],
    ['art', 'arthur'],
    ['curt', 'curtis'],
    ['don', 'donald', 'donnie'],
    ['gabe', 'gabriel'],
    ['hank', 'henry'],
    ['harry', 'harold'],
    ['jack', 'john', 'jackson'],
    ['jerry', 'gerald', 'jeremy'],
    ['lenny', 'leonard'],
    ['lou', 'louis', 'lewis'],
    ['marv', 'marvin'],
    ['max', 'maxwell'],
    ['randy', 'randall'],
    ['ray', 'raymond'],
    ['stu', 'stuart'],
    ['ty', 'tyler'],
    ['vic', 'victor'],
];
const NICKNAME_VARIANTS = new Map();
for (const group of NICKNAME_GROUPS) {
    for (const name of group) {
        const variants = group.filter((n) => n !== name);
        const existing = NICKNAME_VARIANTS.get(name) || [];
        NICKNAME_VARIANTS.set(name, [...new Set([...existing, ...variants])]);
    }
}
function firstNameVariants(firstName) {
    return NICKNAME_VARIANTS.get(firstName.trim().toLowerCase()) || [];
}
// Searches every name variant (stored first name + nicknames) against GHIN and merges the
// results, deduped by ghin+club.
async function searchAllNameVariants(firstName, lastName, state, token) {
    const namesToTry = [firstName, ...firstNameVariants(firstName)];
    const seenKeys = new Set();
    const merged = [];
    for (const name of namesToTry) {
        const results = await searchGhinGolfers(name, lastName, state, token);
        for (const result of results) {
            const key = `${result.ghin}|${result.club}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push(result);
            }
        }
    }
    return merged;
}
// Fetches this GHIN's entire score history and returns only the entries posted at our own
// course, regardless of what club GHIN has on file for them.
async function getScoresAtCourse(ghin, courseName, token) {
    const url = `https://ghin-apiproxy.usga.org/api/v1/scores.json?golfer_id=${ghin}`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
        return [];
    const data = (await response.json());
    const scores = data.scores ?? [];
    const normalizedCourse = normalizeForCompare(courseName);
    return scores
        .filter((s) => normalizeForCompare(s.course_name || s.facility_name || '') === normalizedCourse)
        .map((s) => ({ playedAt: s.played_at, gross: Number(s.adjusted_gross_score) }));
}
/**
 * Manual "Link GHIN" search (ghinplayerlist.tsx) — same idea as `findEasyGhinLinks`'s two
 * passes, but for a single admin-driven search rather than an auto-picked batch match. Runs the
 * normal name/state search, then also checks nationwide for anyone (not already found) who has
 * actually posted a round at our course before — those get appended with `postedAtCourse: true`.
 * Skipped entirely if no `course` is given.
 */
async function searchGhinWithHistoryFallback(firstName, lastName, state, course) {
    const token = await getGhinBearerToken();
    const stateResults = await searchGhinGolfers(firstName, lastName, state, token);
    if (!course)
        return stateResults;
    const nationwideResults = await searchGhinGolfers(firstName, lastName, '', token);
    const alreadyFound = new Set(stateResults.map((r) => `${r.ghin}|${r.club}`));
    const remainingGhins = new Map();
    for (const result of nationwideResults) {
        if (!alreadyFound.has(`${result.ghin}|${result.club}`) && !remainingGhins.has(result.ghin)) {
            remainingGhins.set(result.ghin, result);
        }
    }
    const historyMatches = [];
    for (const [ghin, result] of remainingGhins) {
        const courseScores = await getScoresAtCourse(ghin, course, token);
        if (courseScores.length > 0) {
            historyMatches.push({ ...result, postedAtCourse: true });
        }
    }
    return [...stateResults, ...historyMatches];
}
function toEasyLinkCandidate(row, match, matchedVia) {
    return {
        playerId: row.PlayerID,
        name: `${row.LastName},${row.FirstName}`,
        ghin: match.ghin,
        club: match.club,
        state: match.state,
        handicapIndex: match.handicapIndex,
        status: match.status,
        matchedVia,
    };
}
/**
 * Finds GHIN Network matches for every player on this group's roster who has no GHIN on file
 * and isn't skipped — one bearer token is fetched up front and reused across all searches.
 * Adapted from phoneAI's findEasyGhinLinks: unlike phoneAI, RyderCup doesn't track individual
 * gross scores per round (RyderMatchScore only holds match-play hole results), so there's no
 * data source to disambiguate two different real people who share a name and have both posted
 * at our course — if pass 2 finds more than one such candidate for a player, it's left
 * unresolved (skipped) rather than guessed at, same conservative behavior as phoneAI's own
 * "more than one, can't disambiguate" case.
 *
 * The "our course" context comes from whichever course this group used in `year` (via
 * `getEventCourse`, which already falls back to the closest earlier year if `year` itself has
 * none set) — RyderCup's course changes year to year, unlike phoneAI's fixed-per-event course.
 */
async function findEasyGhinLinks(groupId, year) {
    const [rows] = await config_1.default.query(`SELECT PlayerID, FirstName, LastName
     FROM RyderPlayer
     WHERE GroupID = ?
     AND (GHIN IS NULL OR GHIN = 0)
     AND SkipGhin != 'Y'
     ORDER BY LastName, FirstName`, [groupId]);
    if (rows.length === 0)
        return [];
    const eventCourse = await (0, ryderService_1.getEventCourse)(groupId, year);
    let courseName = '';
    let ghinClubName = null;
    let homeState = 'OH';
    if (eventCourse) {
        const [courseRows] = await config_1.default.query('SELECT CourseName, CourseState, GHINClubName FROM Course WHERE CourseID = ?', [eventCourse.courseId]);
        if (courseRows[0]) {
            courseName = courseRows[0].CourseName;
            ghinClubName = courseRows[0].GHINClubName;
            homeState = courseRows[0].CourseState || 'OH';
        }
    }
    const token = await getGhinBearerToken();
    const candidates = [];
    for (const row of rows) {
        const lastName = String(row.LastName).trim();
        const firstName = String(row.FirstName).trim();
        const pass1Results = await searchAllNameVariants(firstName, lastName, homeState, token);
        const pass1Match = pickEasyMatch(pass1Results, courseName, ghinClubName);
        if (pass1Match) {
            candidates.push(toEasyLinkCandidate(row, pass1Match, 'club'));
            continue;
        }
        const pass2Results = await searchAllNameVariants(firstName, lastName, '', token);
        const distinctGhins = new Map();
        for (const result of [...pass1Results, ...pass2Results]) {
            if (!distinctGhins.has(result.ghin))
                distinctGhins.set(result.ghin, result);
        }
        const postedHere = [];
        for (const [ghin, result] of distinctGhins) {
            const courseScores = await getScoresAtCourse(ghin, courseName, token);
            if (courseScores.length > 0) {
                postedHere.push(result);
            }
        }
        if (postedHere.length === 1) {
            candidates.push(toEasyLinkCandidate(row, postedHere[0], 'history'));
        }
    }
    return candidates;
}
/**
 * Pulls every GHIN-linked player's current index (across every group — GHIN linking isn't
 * scoped to one event) from the live GHIN Network into RyderHdcp as a one-decimal number, but
 * only for players whose RyderHdcp row hasn't been touched yet today — called once when the app
 * launches (see app/_layout.tsx), and a GHIN index doesn't change mid-day, so the SQL filter
 * below is what keeps every visitor's app open from triggering its own round of real GHIN API
 * calls. A same-day manual edit (Admin -> Setup or -> Handicaps) also counts as "touched today"
 * and is left alone rather than immediately overwritten by this. When nothing needs refreshing,
 * this returns without ever fetching a bearer token or calling GHIN at all.
 *
 * `force` skips the "already touched today" filter entirely and re-pulls every GHIN-linked
 * player regardless — the manual "Refresh GHIN" button on Course & Roster passes this, for a
 * captain who wants this morning's posted round reflected right now instead of waiting for
 * tomorrow's automatic refresh.
 */
async function refreshGhinHandicaps(year, force = false) {
    const [rows] = await config_1.default.query(force
        ? `SELECT PlayerID, GHIN FROM RyderPlayer WHERE GHIN IS NOT NULL AND GHIN != 0`
        : `SELECT p.PlayerID, p.GHIN
         FROM RyderPlayer p
         LEFT JOIN RyderHdcp h ON h.PlayerID = p.PlayerID AND h.Year = (
           SELECT MAX(Year) FROM RyderHdcp WHERE PlayerID = p.PlayerID
         )
         WHERE p.GHIN IS NOT NULL AND p.GHIN != 0
           AND (h.LastUpdateDt IS NULL OR DATE(h.LastUpdateDt) < CURDATE())`);
    if (rows.length === 0)
        return;
    const token = await getGhinBearerToken();
    await Promise.all(rows.map(async (r) => {
        const index = await getGolferIndex(Number(r.GHIN), token);
        if (index !== null) {
            await (0, ryderService_1.saveHdcp)(r.PlayerID, year, index, ryderService_1.GHIN_SYNC_USER);
        }
    }));
}
/**
 * When any player's handicap was last actually pulled from the live GHIN Network — the most
 * recent RyderHdcp write tagged GHIN_SYNC_USER, across every group. Shown on Course & Roster
 * next to "Players" so a captain can tell whether today's automatic refresh has run yet (or
 * whether the manual "Refresh GHIN" button needs a tap). Null if GHIN has never been synced.
 */
async function getLastGhinRefresh() {
    const [rows] = await config_1.default.query(`SELECT MAX(LastUpdateDt) AS lastRefreshedAt FROM RyderHdcp WHERE LastUpdateUser = ?`, [ryderService_1.GHIN_SYNC_USER]);
    return rows[0]?.lastRefreshedAt ?? null;
}
/**
 * Search GHIN's course database (the USGA Course Rating and Slope Database, aka CRDB) by name —
 * the same source GHIN itself pulls from when a golfer posts an official score, so building a
 * course from this instead of a scanned photo keeps the numbers consistent with GHIN's own,
 * which matters if this app ever posts scores back. A blank/falsy `state` searches nationwide.
 */
async function searchGhinCourses(name, state) {
    const token = await getGhinBearerToken();
    // GHIN's search silently returns zero results unless state is prefixed "US-" (e.g. "US-NC") —
    // a bare "NC" is accepted with a 200 but matches nothing.
    const locationParam = state ? `state=${encodeURIComponent(`US-${state.toUpperCase()}`)}` : 'country=USA';
    const url = `https://ghin-apiproxy.usga.org/api/v1/courses/search.json?name=${encodeURIComponent(name)}&per_page=25&${locationParam}`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
        return [];
    const data = (await response.json());
    const courses = data.courses ?? [];
    return courses.map((c) => ({
        courseId: c.CourseID,
        courseName: c.CourseName,
        facilityName: c.FacilityName,
        city: c.City ?? null,
        state: (c.State || '').replace(/^US-/, '') || null,
    }));
}
/**
 * Full course detail from GHIN's CRDB — every tee set on file, each with its 18 holes' par,
 * stroke index (GHIN's "Allocation", this app's "Hdcp"), and yardage, plus that tee's own
 * Course/Slope rating. Only tee sets with a complete 18 holes are included — a handful of CRDB
 * entries are legacy/incomplete and would otherwise show up as unusable blank rows.
 */
async function getGhinCourseDetail(courseId) {
    const token = await getGhinBearerToken();
    const url = `https://ghin-apiproxy.usga.org/api/v1/courses/${courseId}.json`;
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!response.ok)
        return null;
    const data = (await response.json());
    const teeSets = (data.TeeSets ?? [])
        .filter((t) => Array.isArray(t.Holes) && t.Holes.length === 18)
        .map((t) => {
        const totalRating = (t.Ratings ?? []).find((r) => r.RatingType === 'Total');
        return {
            teeSetId: t.TeeSetRatingId,
            teeName: t.TeeSetRatingName,
            gender: t.Gender,
            courseRating: totalRating?.CourseRating ?? null,
            slopeRating: totalRating?.SlopeRating ?? null,
            totalPar: t.TotalPar,
            totalYardage: t.TotalYardage,
            holes: [...t.Holes]
                .sort((a, b) => a.Number - b.Number)
                .map((h) => ({ holeNum: h.Number, par: h.Par, hdcp: h.Allocation, yards: h.Length })),
        };
    });
    return {
        courseId: data.CourseId,
        courseName: data.CourseName,
        facilityName: data.Facility?.FacilityName ?? data.CourseName,
        city: data.CourseCity ?? null,
        state: (data.CourseState || '').replace(/^US-/, '') || null,
        teeSets,
    };
}
