"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamBranding = getTeamBranding;
const usaFlagBg = require('../../assets/ryder/team_usa_bg.jpg');
const usaFlagSm = require('../../assets/ryder/team_usa_sm.jpg');
const usaFlagSm50 = require('../../assets/ryder/team_usa_sm50.jpg');
const crownFlagBg = require('../../assets/ryder/team_crown_bg.jpg');
const crownFlagSm = require('../../assets/ryder/team_crown_sm.jpg');
const crownFlagSm50 = require('../../assets/ryder/team_crown_sm50.jpg');
const euroFlagBg = require('../../assets/ryder/team_europe_bg.jpg');
const euroFlagSm = require('../../assets/ryder/team_europe_sm.jpg');
const euroFlagSm50 = require('../../assets/ryder/team_europe_sm50.jpg');
const jesterFlagBg = require('../../assets/ryder/team_jester_bg.jpg');
const jesterFlagSm = require('../../assets/ryder/team_jester_sm.jpg');
const jesterFlagSm50 = require('../../assets/ryder/team_jester_sm50.jpg');
// One All Square composite per real (Team A, Team B) combination -- 'usa-euro' is the original
// generic RyderCupFlags asset every event used before this feature existed.
const ALL_SQUARE = {
    'usa-euro': {
        bg: require('../../assets/ryder/RyderCupFlags_bg.jpg'),
        sm: require('../../assets/ryder/RyderCupFlags_sm.jpg'),
        sm50: require('../../assets/ryder/RyderCupFlags_sm50.jpg'),
    },
    'usa-jester': {
        bg: require('../../assets/ryder/team_jester_allsquare_bg.jpg'),
        sm: require('../../assets/ryder/team_jester_allsquare_sm.jpg'),
        sm50: require('../../assets/ryder/team_jester_allsquare_sm50.jpg'),
    },
    'crown-euro': {
        bg: require('../../assets/ryder/team_crown_euro_allsquare_bg.jpg'),
        sm: require('../../assets/ryder/team_crown_euro_allsquare_sm.jpg'),
        sm50: require('../../assets/ryder/team_crown_euro_allsquare_sm50.jpg'),
    },
    'crown-jester': {
        bg: require('../../assets/ryder/team_crown_jester_allsquare_bg.jpg'),
        sm: require('../../assets/ryder/team_crown_jester_allsquare_sm.jpg'),
        sm50: require('../../assets/ryder/team_crown_jester_allsquare_sm50.jpg'),
    },
};
/**
 * Resolves an event's team names/flag images from its RyderOptions.teamAFlag/teamBFlag setting.
 * One shared place instead of every screen independently require()-ing the team_usa/team_europe
 * images and hardcoding "USA"/"Euro"/"Europe" strings -- see useTeamBranding (src/context/
 * TeamBrandingContext.tsx) for the hook every screen actually calls.
 */
function getTeamBranding(teamAFlag, teamBFlag) {
    const crown = teamAFlag === 'crown';
    const jester = teamBFlag === 'jester';
    const tied = ALL_SQUARE[`${teamAFlag}-${teamBFlag}`] ?? ALL_SQUARE['usa-euro'];
    return {
        aName: crown ? 'Team Crown' : 'Team USA',
        aShortName: crown ? 'Crown' : 'USA',
        bName: jester ? 'Team Jester' : 'Team Euro',
        bShortName: jester ? 'Jester' : 'Euro',
        aFlagBg: crown ? crownFlagBg : usaFlagBg,
        aFlagSm: crown ? crownFlagSm : usaFlagSm,
        aFlagSm50: crown ? crownFlagSm50 : usaFlagSm50,
        bFlagBg: jester ? jesterFlagBg : euroFlagBg,
        bFlagSm: jester ? jesterFlagSm : euroFlagSm,
        bFlagSm50: jester ? jesterFlagSm50 : euroFlagSm50,
        tiedFlagBg: tied.bg,
        tiedFlagSm: tied.sm,
        tiedFlagSm50: tied.sm50,
    };
}
