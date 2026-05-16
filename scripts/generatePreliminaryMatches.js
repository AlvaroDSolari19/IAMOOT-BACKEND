const { MongoClient } = require('mongodb');
require('dotenv').config();

function createMatch(preliminaryMatches, teamTrackers, stateTeam, victimTeam, matchIDCounter) {

    const stateTeamTracker = teamTrackers[stateTeam.teamID];
    const victimTeamTracker = teamTrackers[victimTeam.teamID];

    const needsTranslation = stateTeam.teamLanguage !== victimTeam.teamLanguage;
    const matchLanguages = needsTranslation ? [stateTeam.teamLanguage, victimTeam.teamLanguage] : [stateTeam.teamLanguage];

    const newMatch = {
        matchID: `M${matchIDCounter}`,
        stateTeam: stateTeam.teamID,
        victimTeam: victimTeam.teamID,
        stateTeamUniversity: stateTeam.universityName,
        victimTeamUniversity: victimTeam.universityName,
        stateTeamLanguage: stateTeam.teamLanguage,
        victimTeamLanguage: victimTeam.teamLanguage,
        needsTranslation,
        matchLanguages,
        roomNumber: null,
        matchDate: null,
        matchTime: null,
        assignedJudges: [],
        winningTeam: null
    }

    preliminaryMatches.push(newMatch);

    stateTeamTracker.matchCount = stateTeamTracker.matchCount + 1;
    stateTeamTracker.stateCount = stateTeamTracker.stateCount + 1;
    stateTeamTracker.opponentTeamIDs.push(victimTeam.teamID);

    victimTeamTracker.matchCount = victimTeamTracker.matchCount + 1;
    victimTeamTracker.victimCount = victimTeamTracker.victimCount + 1;
    victimTeamTracker.opponentTeamIDs.push(stateTeam.teamID);

    if (needsTranslation) {
        stateTeamTracker.translationMatchCount = stateTeamTracker.translationMatchCount + 1;
        victimTeamTracker.translationMatchCount = victimTeamTracker.translationMatchCount + 1;
    }

    return matchIDCounter + 1;
}

function shuffleArray(originalArray) {
    const shuffledArray = [...originalArray];

    for (let currentIndex = shuffledArray.length - 1; currentIndex > 0; currentIndex--) {
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        const temporaryValue = shuffledArray[currentIndex];
        shuffledArray[currentIndex] = shuffledArray[randomIndex];
        shuffledArray[randomIndex] = temporaryValue;
    }

    return shuffledArray;
}

function getEligibleTranslationTeams(teamsByLanguage, teamTrackers, languageCode) {
    return shuffleArray(teamsByLanguage[languageCode]).filter(currentTeam => {
        const currentTracker = teamTrackers[currentTeam.teamID];
        return currentTracker.matchCount < 2;
    })
}

function haveTeamsPlayedEachOther(teamTrackers, firstTeam, secondTeam) {
    const firstTeamTracker = teamTrackers[firstTeam.teamID];
    return firstTeamTracker.opponentTeamIDs.includes(secondTeam.teamID);
}

function generateTranslationMatches(preliminaryMatches, teamTrackers, teamsByLanguage, matchIDCounter) {

    const translationMatchPlan = [
        ['EN', 'SPA'],
        ['EN', 'SPA'],
        ['EN', 'SPA'],
        ['EN', 'SPA'],

        ['EN', 'POR'],
        ['EN', 'POR'],
        ['EN', 'POR'],
        ['EN', 'POR'],

        ['SPA', 'POR'],
        ['SPA', 'POR'],
        ['SPA', 'POR'],
        ['SPA', 'POR'],
    ];

    for (const currentPairing of translationMatchPlan) {
        const firstLanguage = currentPairing[0];
        const secondLanguage = currentPairing[1];

        const eligibleFirstTeams = getEligibleTranslationTeams(teamsByLanguage, teamTrackers, firstLanguage);
        const eligibleSecondTeams = getEligibleTranslationTeams(teamsByLanguage, teamTrackers, secondLanguage);

        if (eligibleFirstTeams.length === 0 || eligibleSecondTeams.length === 0) {
            throw new Error(`Unable to generate translation match for ${firstLanguage}-${secondLanguage}.`);
        }

        let firstTeam = null;
        let secondTeam = null;

        for (const currentFirstTeam of eligibleFirstTeams) {
            const validSecondTeam = eligibleSecondTeams.find(currentSecondTeam => {
                return !haveTeamsPlayedEachOther(teamTrackers, currentFirstTeam, currentSecondTeam)
            });

            if (validSecondTeam) {
                firstTeam = currentFirstTeam;
                secondTeam = validSecondTeam;
                break;
            }
        }

        if (!firstTeam || !secondTeam) {
            throw new Error(`Unable to find non-rematch translations pairing for ${firstLanguage}-${secondLanguage}`);
        }

        const firstTeamTracker = teamTrackers[firstTeam.teamID];
        const secondTeamTracker = teamTrackers[secondTeam.teamID];

        let stateTeam = firstTeam;
        let victimTeam = secondTeam;

        if (firstTeamTracker.stateCount > firstTeamTracker.victimCount) {
            stateTeam = secondTeam;
            victimTeam = firstTeam;
        } else if (secondTeamTracker.victimCount > secondTeamTracker.stateCount) {
            stateTeam = secondTeam;
            victimTeam = firstTeam;
        }

        matchIDCounter = createMatch(preliminaryMatches, teamTrackers, stateTeam, victimTeam, matchIDCounter);

    }

    return matchIDCounter;

}

function getTeamsNeedingMatches(teamTrackers, teamsByLanguage, languageCode) {
    return shuffleArray(teamsByLanguage[languageCode]).filter(currentTeam => {
        const currentTracker = teamTrackers[currentTeam.teamID];
        return currentTracker.matchCount < 2;
    });
}

function chooseRolesForMatch(teamTrackers, firstTeam, secondTeam) {
    const firstTeamTracker = teamTrackers[firstTeam.teamID];
    const secondTeamTracker = teamTrackers[secondTeam.teamID];

    if (firstTeamTracker.stateCount === 0 && secondTeamTracker.victimCount === 0) {
        return {
            stateTeam: firstTeam,
            victimTeam: secondTeam
        };
    }

    if (firstTeamTracker.victimCount === 0 && secondTeamTracker.stateCount === 0) {
        return {
            stateTeam: secondTeam,
            victimTeam: firstTeam
        };
    }

    if (firstTeamTracker.stateCount <= firstTeamTracker.victimCount) {
        return {
            stateTeam: firstTeam,
            victimTeam: secondTeam,
        };
    }

    return {
        stateTeam: secondTeam,
        victimTeam: firstTeam
    };
}

function generateRemainingSameLanguageMatches(preliminaryMatches, teamTrackers, teamsByLanguage, matchIDCounter) {
    const languageCodes = Object.keys(teamsByLanguage);

    for (const currentLanguage of languageCodes) {
        let teamsNeedingMatches = getTeamsNeedingMatches(teamTrackers, teamsByLanguage, currentLanguage);

        while (teamsNeedingMatches.length >= 2) {
            const firstTeam = teamsNeedingMatches[0];

            const secondTeam = teamsNeedingMatches.find(currentTeam => {
                return currentTeam.teamID !== firstTeam.teamID && !haveTeamsPlayedEachOther(teamTrackers, firstTeam, currentTeam);
            });

            if (!secondTeam) {
                throw new Error(`Unable to find same-language opponent for team ${firstTeam.teamID} in ${currentLanguage}.`);
            }

            const selectedRoles = chooseRolesForMatch(teamTrackers, firstTeam, secondTeam);

            matchIDCounter = createMatch(preliminaryMatches, teamTrackers, selectedRoles.stateTeam, selectedRoles.victimTeam, matchIDCounter);

            teamsNeedingMatches = getTeamsNeedingMatches(teamTrackers, teamsByLanguage, currentLanguage);
        }
    }

    return matchIDCounter;
}

function getProblematicTeams(teamTrackers) {
    return Object.values(teamTrackers).filter(currentTracker => {
        return currentTracker.stateCount === 0 || currentTracker.victimCount === 0;
    });
}

function getTeamsBelowMinimumMatches(teamTrackers) {
    return Object.values(teamTrackers).filter(currentTracker => {
        return currentTracker.matchCount < 2;
    })
}

function createTeamTrackers(activeTeams) {
    const teamTrackers = {};

    for (const currentTeam of activeTeams) {
        teamTrackers[currentTeam.teamID] = {
            teamID: currentTeam.teamID,
            universityName: currentTeam.universityName,
            teamLanguage: currentTeam.teamLanguage,
            matchCount: 0,
            stateCount: 0,
            victimCount: 0,
            translationMatchCount: 0,
            opponentTeamIDs: []
        }
    }

    return teamTrackers;
}

function generateOneScheduleAttempt(activeTeams, teamsByLanguage) {
    const teamTrackers = createTeamTrackers(activeTeams);
    const preliminaryMatches = [];
    let matchIDCounter = 1;

    matchIDCounter = generateTranslationMatches(preliminaryMatches, teamTrackers, teamsByLanguage, matchIDCounter);
    matchIDCounter = generateRemainingSameLanguageMatches(preliminaryMatches, teamTrackers, teamsByLanguage, matchIDCounter);

    const teamsBelowMinimumMatches = getTeamsBelowMinimumMatches(teamTrackers);
    const problematicTeams = getProblematicTeams(teamTrackers);

    return {
        preliminaryMatches,
        teamTrackers,
        matchIDCounter,
        teamsBelowMinimumMatches,
        problematicTeams
    };
}

function getAttemptScore(currentAttempt) {
    const problematicCount = currentAttempt.problematicTeams.length;

    let requiresExtraTranslationMatch = false;

    if (problematicCount === 2) {
        const firstProblemTeam = currentAttempt.problematicTeams[0];
        const secondProblemTeam = currentAttempt.problematicTeams[1];
        if (firstProblemTeam.teamLanguage !== secondProblemTeam.teamLanguage) requiresExtraTranslationMatch = true;
    }

    return {
        problematicCount,
        requiresExtraTranslationMatch
    };
}

function findBestScheduleAttempt(activeTeams, teamsByLanguage, maxAttempts) {
    let bestAttempt = null;

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
        try {
            const currentAttempt = generateOneScheduleAttempt(activeTeams, teamsByLanguage);

            if (currentAttempt.teamsBelowMinimumMatches.length > 0) {
                continue;
            }

            const currentScore = getAttemptScore(currentAttempt);
            const bestScore = bestAttempt ? getAttemptScore(bestAttempt) : null;

            if (!bestAttempt || currentScore.problematicCount < bestScore.problematicCount || (currentScore.problematicCount === bestScore.problematicCount && currentScore.requiresExtraTranslationMatch < bestScore.requiresExtraTranslationMatch)) {
                bestAttempt = currentAttempt;
                if (currentScore.problematicCount === 2) {
                    console.log(`New best attempt found on attempt ${attemptNumber}: ${currentScore.problematicCount} problematic team(s), extra translation match required: ${currentScore.requiresExtraTranslationMatch}`);

                } else {
                    console.log(`New best attempt found on attempt ${attemptNumber}: ${currentScore.problematicCount} problematic team(s).`)
                }
            }

            if (currentAttempt.problematicTeams.length === 0) {
                break;
            }

        } catch (error) {
            continue;
        }
    }

    if (!bestAttempt) {
        throw new Error(`Unable to generate a valid schedule attempt after ${maxAttempts} attempts.`);
    }

    return bestAttempt;
}

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI_PROD);

    try {
        await client.connect();

        const db = client.db('IAMOOT-2026');
        const matchesCollection = db.collection('preliminaryMatches'); 
        const teamsCollection = db.collection('teams');

        const activeTeams = await teamsCollection.find({ isParticipating: { $ne: false } }).toArray();
        if (activeTeams.length === 0) {
            console.error(`No active teams found in the database.`);
            return;
        }

        const teamsByLanguage = {};

        for (const currentTeam of activeTeams) {
            const currentLanguage = currentTeam.teamLanguage || 'Unknown';
            if (!teamsByLanguage[currentLanguage]) teamsByLanguage[currentLanguage] = [];
            teamsByLanguage[currentLanguage].push(currentTeam);
        }

        console.log(`Total active teams: ${activeTeams.length}`);

        for (const currentLanguage in teamsByLanguage) {
            console.log(`${currentLanguage}: ${teamsByLanguage[currentLanguage].length} team(s)`);
        }

        const bestAttempt = findBestScheduleAttempt(activeTeams, teamsByLanguage, 50000);

        const preliminaryMatches = bestAttempt.preliminaryMatches;
        const teamTrackers = bestAttempt.teamTrackers;
        const teamsBelowMinimumMatches = bestAttempt.teamsBelowMinimumMatches;
        const problematicTeams = bestAttempt.problematicTeams;

        console.log(`Generated ${preliminaryMatches.length} total preliminary matches.`);
        console.table(Object.values(teamTrackers).map(currentTracker => ({
            teamID: currentTracker.teamID,
            language: currentTracker.teamLanguage,
            matches: currentTracker.matchCount,
            state: currentTracker.stateCount,
            victim: currentTracker.victimCount,
            translations: currentTracker.translationMatchCount
        })));

        console.log(`Teams below 2 matches: ${teamsBelowMinimumMatches.length}`);

        console.log(`Problematic teams: ${problematicTeams.length}`);
        console.table(problematicTeams.map(currentTracker => ({
            teamID: currentTracker.teamID,
            language: currentTracker.teamLanguage,
            matches: currentTracker.matchCount,
            state: currentTracker.stateCount,
            victim: currentTracker.victimCount,
            translations: currentTracker.translationMatchCount,
            missingRole: currentTracker.stateCount === 0 ? 'State' : 'Victim'
        })));

        if (teamsBelowMinimumMatches.length > 0 || problematicTeams.length > 0){
            throw new Error(`Generated schedule is not valid. Matches were not inserted.`);
        }

        await matchesCollection.deleteMany({}); 
        await matchesCollection.insertMany(preliminaryMatches); 
        console.log(`${preliminaryMatches.length} preliminary matches inserted into preliminaryMatches collection.`);

    } catch (error) {
        console.error('Error generating preliminary matches: ', error);
    } finally {
        await client.close();
    }
}

main(); 