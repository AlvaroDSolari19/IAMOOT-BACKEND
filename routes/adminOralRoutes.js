const express = require('express');
const { getCollection } = require('../db');

const router = express.Router();

/********************
 * HELPER FUNCTIONS *
 ********************/
const calculateAverageScore = (scoresByJudge) => {
    if (!Array.isArray(scoresByJudge) || scoresByJudge.length === 0) return null;

    const totalScoreSum = scoresByJudge.reduce((totalSum, currentScore) => {
        return totalSum + Number(currentScore.totalScore || 0);
    }, 0);

    return totalScoreSum / scoresByJudge.length;
}

const calculateSpeakerAverage = (receivedScores) => {
    if (!Array.isArray(receivedScores) || receivedScores.length === 0) return null;

    const totalScoreSum = receivedScores.reduce((totalSum, currentScore) => {
        return totalSum + Number(currentScore.score || 0);
    }, 0);

    return totalScoreSum / receivedScores.length;
}

/***********************
 * PRELIMINARY MATCHES *
 ***********************/
router.get('/admin/oral/preliminary-matches', async (req, res) => {

    try {

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');

        const preliminaryMatches = await preliminaryMatchesCollection.find({}).project({
            _id: 0,
            matchID: 1,
            stateTeam: 1,
            victimTeam: 1,
            stateTeamUniversity: 1,
            victimTeamUniversity: 1,
            matchDay: 1,
            matchDate: 1,
            matchTime: 1,
            roomNumber: 1,
            winningTeam: 1
        }).toArray();

        preliminaryMatches.sort((firstMatch, secondMatch) => {
            const firstMatchDateTime = new Date(`${firstMatch.matchDate} ${firstMatch.matchTime}`);
            const secondMatchDateTime = new Date(`${secondMatch.matchDate} ${secondMatch.matchTime}`);
            return firstMatchDateTime - secondMatchDateTime;
        })

        return res.status(200).json({
            ok: true,
            message: 'Preliminary matches retrieved successfully.',
            preliminaryMatches
        });

    } catch (error) {
        console.error('Preliminary matches error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve preliminary matches.' });
    }
});

/*****************************
 * PRELIMINARY MATCH DETAILS *
 *****************************/
router.get('/admin/oral/preliminary-match/:matchID', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim();
        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');

        const matchRecord = await preliminaryMatchesCollection.findOne(
            { matchID },
            {
                projection: {
                    _id: 0,
                    matchID: 1,
                    stateTeam: 1,
                    victimTeam: 1,
                    stateTeamUniversity: 1,
                    victimTeamUniversity: 1,
                    matchDay: 1,
                    matchTime: 1,
                    roomNumber: 1,
                    assignedJudges: 1,
                    winningTeam: 1
                }
            }
        );

        if (!matchRecord) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        return res.status(200).json({
            ok: true,
            message: 'Preliminary match details retrieved successfully.',
            match: matchRecord
        });

    } catch (error) {
        console.error('Preliminary match details error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve preliminary match details.' });
    }

});

/**********************
 * SEARCH ORAL JUDGES *
 **********************/
router.get('/admin/oral/judges', async (req, res) => {

    try {

        const judgeSearchValue = String(req.query.judgeID || '').trim();

        const preliminaryJudgesCollection = getCollection('preliminaryJudges');
        const judgeQuery = judgeSearchValue ? { $expr: { $regexMatch: { input: { $toString: '$judgeID' }, regex: `^${judgeSearchValue}` } } } : {};

        const matchingJudges = await preliminaryJudgesCollection.find(judgeQuery).project({
            _id: 0,
            judgeID: 1,
            fullName: 1
        }).sort({
            judgeID: 1
        }).toArray();

        return res.status(200).json({
            ok: true,
            message: 'Oral judges retrieved successfully.',
            matchingJudges
        });

    } catch (error) {
        console.error('Oral judges search error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve oral judges.' });
    }

});

/*************************
 * ADD PRELIMINARY JUDGE *
 *************************/
router.patch('/admin/oral/preliminary-match/:matchID/judges', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim();
        const judgeID = Number(req.body.judgeID);

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (Number.isNaN(judgeID)) return res.status(400).json({ ok: false, message: 'Judge ID is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');
        const preliminaryJudgesCollection = getCollection('preliminaryJudges');

        const judgeRecord = await preliminaryJudgesCollection.findOne(
            { judgeID },
            {
                projection: {
                    _id: 0,
                    judgeID: 1,
                    fullName: 1
                }
            }
        );

        if (!judgeRecord) return res.status(404).json({ ok: false, message: 'Judge was not found.' });

        const assignedJudge = {
            judgeID: judgeRecord.judgeID,
            judgeName: judgeRecord.fullName
        };

        await preliminaryMatchesCollection.updateOne(
            { matchID },
            {
                $push: {
                    assignedJudges: assignedJudge
                }
            }
        );

        return res.status(200).json({
            ok: true,
            message: 'Judge added successfully.'
        })

    } catch (error) {
        console.error('Add preliminary judge error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to add judge.' });
    }

});

/****************************
 * REMOVE PRELIMINARY JUDGE *
 ****************************/
router.patch('/admin/oral/preliminary-match/:matchID/judges/remove', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim();
        const judgeID = Number(req.body.judgeID);

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (Number.isNaN(judgeID)) return res.status(400).json({ ok: false, message: 'Judge ID is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');

        const updateResult = await preliminaryMatchesCollection.updateOne(
            { matchID },
            {
                $pull: {
                    assignedJudges: { judgeID }
                }
            }
        );

        if (updateResult.matchedCount === 0) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        return res.status(200).json({
            ok: true,
            message: 'Judge removed successfully.'
        });

    } catch (error) {
        console.error('Remove preliminary judge error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to remove judge.' });
    }

});

/***********************
 * UPDATE WINNING TEAM *
 ***********************/
router.patch('/admin/oral/preliminary-match/:matchID/winner', async (req, res) => {

    try {
        const matchID = String(req.params.matchID || '').trim();
        const winningTeam = String(req.body.winningTeam || '').trim();

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (!winningTeam) return res.status(400).json({ ok: false, message: 'Winning team is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');

        const matchRecord = await preliminaryMatchesCollection.findOne(
            { matchID },
            {
                projection: {
                    _id: 0,
                    stateTeam: 1,
                    victimTeam: 1
                }
            }
        );

        if (!matchRecord) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        const validWinningTeams = [matchRecord.stateTeam, matchRecord.victimTeam];
        if (!validWinningTeams.includes(winningTeam)) return res.status(400).json({ ok: false, message: 'Winning team must belong to this match.' });

        await preliminaryMatchesCollection.updateOne(
            { matchID },
            {
                $set: {
                    winningTeam
                }
            }
        );

        return res.status(200).json({
            ok: true,
            message: 'Winning team updated successfully.'
        });

    } catch (error) {
        console.error('Preliminary match winner update error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to update winning team.' });
    }

});

/***********************
 * PRELIMINARY RESULTS *
 ***********************/
router.get('/admin/oral/preliminary-results', async (req, res) => {

    try {

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');
        const memorandaCollection = getCollection('memoranda');

        const preliminaryMatches = await preliminaryMatchesCollection.find({}).project({
            _id: 0,
            stateTeam: 1,
            victimTeam: 1,
            stateTeamUniversity: 1,
            victimTeamUniversity: 1,
            winningTeam: 1
        }).toArray();

        const allMemoranda = await memorandaCollection.find({}).project({
            _id: 0,
            teamID: 1,
            status: 1,
            scoresByJudge: 1,
            penaltyPoints: 1
        }).toArray();

        const getMemorandumAverage = (teamID) => {

            const stateMemorandum = allMemoranda.find((memorandumRecord) => {
                return memorandumRecord.teamID === teamID && memorandumRecord.status === 'State';
            });

            const victimMemorandum = allMemoranda.find((memorandumRecord) => {
                return memorandumRecord.teamID === teamID && memorandumRecord.status === 'Victim';
            });

            const rawStateAverage = calculateAverageScore(stateMemorandum?.scoresByJudge);
            const rawVictimAverage = calculateAverageScore(victimMemorandum?.scoresByJudge);

            const statePenaltyPoints = Number(stateMemorandum?.penaltyPoints || 0);
            const victimPenaltyPoints = Number(victimMemorandum?.penaltyPoints || 0);

            const stateAverage = rawStateAverage !== null ? rawStateAverage - statePenaltyPoints : null;
            const victimAverage = rawVictimAverage !== null ? rawVictimAverage - victimPenaltyPoints : null;

            return stateAverage !== null && victimAverage !== null ? (stateAverage + victimAverage) / 2 : null;

        }

        const resultsByTeam = {};

        preliminaryMatches.forEach((currentMatch) => {

            if (!resultsByTeam[currentMatch.stateTeam]) {
                resultsByTeam[currentMatch.stateTeam] = {
                    teamID: currentMatch.stateTeam,
                    universityName: currentMatch.stateTeamUniversity,
                    numberOfWins: 0,
                    numberOfLosses: 0,
                    memorandumAverage: getMemorandumAverage(currentMatch.stateTeam)
                };
            }

            if (!resultsByTeam[currentMatch.victimTeam]) {
                resultsByTeam[currentMatch.victimTeam] = {
                    teamID: currentMatch.victimTeam,
                    universityName: currentMatch.victimTeamUniversity,
                    numberOfWins: 0,
                    numberOfLosses: 0,
                    memorandumAverage: getMemorandumAverage(currentMatch.victimTeam)
                };
            }

            if (currentMatch.winningTeam) {
                const losingTeam = currentMatch.winningTeam === currentMatch.stateTeam ? currentMatch.victimTeam : currentMatch.stateTeam;
                resultsByTeam[currentMatch.winningTeam].numberOfWins = resultsByTeam[currentMatch.winningTeam].numberOfWins + 1;
                resultsByTeam[losingTeam].numberOfLosses = resultsByTeam[losingTeam].numberOfLosses + 1;
            }

        });

        const preliminaryResults = Object.values(resultsByTeam).sort((firstTeam, secondTeam) => {

            if (firstTeam.numberOfWins !== secondTeam.numberOfWins) {
                return secondTeam.numberOfWins - firstTeam.numberOfWins;
            }

            if (firstTeam.memorandumAverage === null) return 1;
            if (secondTeam.memorandumAverage === null) return -1;

            return secondTeam.memorandumAverage - firstTeam.memorandumAverage;

        });

        return res.status(200).json({
            ok: true,
            message: 'Preliminary results retrieved successfully.',
            preliminaryResults
        });

    } catch (error) {
        console.error('Preliminary results error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve preliminary results.' });
    }

});

/*********************
 * INDIVIDUAL AWARDS * 
 *********************/
router.get('/admin/oral/individual-awards', async (req, res) => {

    try {

        const speakersCollection = getCollection('speakers');
        const teamsCollection = getCollection('teams');

        const allSpeakers = await speakersCollection.find({}).project({
            _id: 0,
            speakerID: 1,
            speakerName: 1,
            speakerLanguage: 1,
            teamID: 1,
            receivedScores: 1
        }).toArray();

        const allTeams = await teamsCollection.find({}).project({
            _id: 0,
            teamID: 1,
            universityName: 1,
        }).toArray();

        const individualAwards = allSpeakers.map((speakerRecord) => {
            const teamRecord = allTeams.find((currentTeam) => {
                return Number(currentTeam.teamID) === speakerRecord.teamID;
            });

            return {
                speakerID: speakerRecord.speakerID,
                speakerName: speakerRecord.speakerName,
                universityName: teamRecord?.universityName || 'N/A',
                speakerLanguage: speakerRecord.speakerLanguage,
                speakerAverage: calculateSpeakerAverage(speakerRecord.receivedScores)
            };
        });

        individualAwards.sort((firstSpeaker, secondSpeaker) => {
            if (firstSpeaker.speakerAverage === null) return 1;
            if (secondSpeaker.speakerAverage === null) return -1;

            return secondSpeaker.speakerAverage - firstSpeaker.speakerAverage;
        });

        return res.status(200).json({
            ok: true,
            message: 'Individual awards retrieved successfully.',
            individualAwards
        });

    } catch (error) {
        console.error('Individual awards error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve individual awards.' });
    }

});

/*********************
 * SEMIFINAL MATCHES *
 *********************/
router.get('/admin/oral/semifinals/matches', async (req,res) => {

    try {
        
        const semifinalMatchesCollection = getCollection('semifinalMatches'); 
        const teamsCollection = getCollection('teams'); 

        const semifinalMatches = await semifinalMatchesCollection.find({}).toArray(); 

        const teamIDs = semifinalMatches.flatMap((matchRecord) => [
            String(matchRecord.stateTeam),
            String(matchRecord.victimTeam)
        ]);

        const teamRecords = await teamsCollection.find({ teamID: { $in: teamIDs } }).toArray(); 
        
        const teamMap = {};

        teamRecords.forEach((teamRecord) => {
            teamMap[String(teamRecord.teamID)] = teamRecord; 
        });

        const enrichedSemifinalMatches = semifinalMatches.map((matchRecord) => {
            const stateTeamRecord = teamMap[String(matchRecord.stateTeam)];
            const victimTeamRecord = teamMap[String(matchRecord.victimTeam)];

            return {
                matchID: matchRecord.matchID, 
                stateTeam: matchRecord.stateTeam, 
                victimTeam: matchRecord.victimTeam, 
                stateTeamUniversity: stateTeamRecord?.universityName || 'Unknown University', 
                victimTeamUniversity: victimTeamRecord?.universityName || 'Unknown University', 
                matchDay: matchRecord.matchDay, 
                matchDate: matchRecord.matchDate, 
                matchTime: matchRecord.matchTime, 
                roomNumber: matchRecord.roomNumber
            }
        });

        enrichedSemifinalMatches.sort((firstMatch, secondMatch) => {
            const firstMatchDateTime = new Date(`${firstMatch.matchDate} ${firstMatch.matchTime}`); 
            const secondMatchDateTime = new Date(`${secondMatch.matchDate} ${secondMatch.matchTime}`);
            return firstMatchDateTime - secondMatchDateTime; 
        }); 

        res.status(200).json({
            ok: true, 
            message: 'Semifinal matches retrieved successfully.', 
            semifinalMatches: enrichedSemifinalMatches
        });

    } catch (error){
        console.error('Error retrieving semifinal matches: ', error); 
        res.status(500).json({ ok: false, message: 'Server error while retrieving semifinal matches.' });
    }

});

/***************************
 * SEMIFINAL MATCH DETAILS *
 ***************************/
router.get('/admin/oral/semifinal-match/:matchID', async (req, res) => {

    try {

        const { matchID } = req.params; 

        const semifinalMatchesCollection = getCollection('semifinalMatches'); 
        const teamsCollection = getCollection('teams'); 

        const matchRecord = await semifinalMatchesCollection.findOne({ matchID }); 
        if (!matchRecord) return res.status(404).json({ ok: false, message: 'Semifinal match not found.' });

        const teamIDs = [
            String(matchRecord.stateTeam), 
            String(matchRecord.victimTeam)
        ];

        const teamRecords = await teamsCollection.find({ teamID: { $in: teamIDs } }).toArray();

        const teamMap = {};

        teamRecords.forEach((teamRecord) => {
            teamMap[String(teamRecord.teamID)] = teamRecord; 
        }); 

        const stateTeamRecord = teamMap[String(matchRecord.stateTeam)]; 
        const victimTeamRecord = teamMap[String(matchRecord.victimTeam)]; 

        const enrichedMatch = {
            matchID: matchRecord.matchID, 
            stateTeam: matchRecord.stateTeam, 
            victimTeam: matchRecord.victimTeam, 
            stateTeamUniversity: stateTeamRecord?.universityName || 'Unknown University', 
            victimTeamUniversity: victimTeamRecord?.universityName || 'Unknown University', 
            matchDay: matchRecord.matchDay, 
            matchTime: matchRecord.matchTime, 
            roomNumber: matchRecord.roomNumber, 
            assignedJudges: matchRecord.assignedJudges || []
        };

        res.status(200).json({
            ok: true, 
            message: 'Semifinal match retrieved successfully.', 
            match: enrichedMatch
        });

    } catch (error) {
        console.error('Error retrieving semifinal match: ', error);
        res.status(500).json({ ok: false, message: 'Server error while retrieving semifinal match.' });
    }

});

/***************************
 * SEARCH SEMIFINAL JUDGES *
 ***************************/
router.get('/admin/oral/semifinal-judges', async (req, res) => {

    try {

        const judgeSearchValue = String(req.query.judgeID || '').trim();

        const preliminaryJudgesCollection = getCollection('preliminaryJudges');
        const judgeQuery = { participatesInSemifinals: true };
        
        if (judgeSearchValue){
            judgeQuery.$expr = { $regexMatch: { input: { $toString: '$judgeID' }, regex: `^${judgeSearchValue}` } }
        } 

        const matchingJudges = await preliminaryJudgesCollection.find(judgeQuery).project({
            _id: 0,
            judgeID: 1,
            fullName: 1
        }).sort({
            judgeID: 1
        }).toArray();

        return res.status(200).json({
            ok: true,
            message: 'Semifinal judges retrieved successfully.',
            matchingJudges
        });

    } catch (error) {
        console.error('Oral judges search error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve oral judges.' });
    }

});

/*************************
 * ADD SEMIFINAL JUDGE *
 *************************/
router.patch('/admin/oral/semifinal-match/:matchID/judges', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim();
        const judgeID = Number(req.body.judgeID);

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (Number.isNaN(judgeID)) return res.status(400).json({ ok: false, message: 'Judge ID is required.' });

        const semifinalMatchesCollection = getCollection('semifinalMatches');
        const preliminaryJudgesCollection = getCollection('preliminaryJudges');

        const judgeRecord = await preliminaryJudgesCollection.findOne(
            { 
                judgeID,
                participatesInSemifinals: true 
            },
            {
                projection: {
                    _id: 0,
                    judgeID: 1,
                    fullName: 1
                }
            }
        );

        if (!judgeRecord) return res.status(404).json({ ok: false, message: 'Semifinal judge was not found.' });

        const assignedJudge = {
            judgeID: judgeRecord.judgeID,
            judgeName: judgeRecord.fullName
        };

        await semifinalMatchesCollection.updateOne(
            { matchID },
            {
                $push: {
                    assignedJudges: assignedJudge
                }
            }
        );

        return res.status(200).json({
            ok: true,
            message: 'Semifinal judge added successfully.'
        })

    } catch (error) {
        console.error('Add preliminary judge error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to add judge.' });
    }

});

/****************************
 * REMOVE SEMIFINAL JUDGE *
 ****************************/
router.patch('/admin/oral/semifinal-match/:matchID/judges/remove', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim();
        const judgeID = Number(req.body.judgeID);

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (Number.isNaN(judgeID)) return res.status(400).json({ ok: false, message: 'Judge ID is required.' });

        const semifinalMatchesCollection = getCollection('semifinalMatches');

        const updateResult = await semifinalMatchesCollection.updateOne(
            { matchID },
            {
                $pull: {
                    assignedJudges: { judgeID }
                }
            }
        );

        if (updateResult.matchedCount === 0) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        return res.status(200).json({
            ok: true,
            message: 'Judge removed successfully.'
        });

    } catch (error) {
        console.error('Remove preliminary judge error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to remove judge.' });
    }

});

module.exports = router; 