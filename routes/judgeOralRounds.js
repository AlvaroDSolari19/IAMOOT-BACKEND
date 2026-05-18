const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db'); 
const requireJudgeAuth = require('../middleware/requireJudgeAuth');

function isJudgeAssignedToMatch(match, judgeID) {
    const assignedJudges = match.assignedJudges || [];

    return assignedJudges.some((assignedJudge) => {
        if (typeof assignedJudge === 'number') {
            return assignedJudge === judgeID;
        }

        return Number(assignedJudge.judgeID) === judgeID;
    });
}

function hasJudgeAlreadyGraded(match, judgeID) {
    const gradedJudges = match.gradedJudges || [];

    return gradedJudges.some((gradedJudge) => { 
        if (typeof gradedJudge === 'number') {
            return gradedJudge === judgeID;
        }

        return Number(gradedJudge.judgeID) === judgeID;
    });
}

router.get('/oralrounds/me/matches', requireJudgeAuth, async(req, res) =>{
    const judgeID = Number(req.authJudgeID);

    try {
        const matchesCollection = getCollection('preliminaryMatches');

        const assignedMatches = await matchesCollection.find({
            $or: [
                {assignedJudges: judgeID},
                {'assignedJudges.judgeID': judgeID}
            ]
        }).toArray();

        const ungradedMatches = assignedMatches.filter((currentMatch) => {
            return !hasJudgeAlreadyGraded(currentMatch, judgeID);
        });

        const normalizedMatches = ungradedMatches.map((currentMatch) => ({
            matchID: currentMatch.matchID,
            firstTeam: currentMatch.victimTeam,
            firstTeamRole: 'Victim',
            secondTeam: currentMatch.stateTeam,
            secondTeamRole: 'State',
            roomNumber: currentMatch.roomNumber,
            matchTime: currentMatch.matchTime,
            matchDay: currentMatch.matchDay,
            needsTranslation: currentMatch.needsTranslation,
            matchLanguages: currentMatch.matchLanguages,
        }));

        return res.json(normalizedMatches);
    } catch (error) {
        console.error(`Error fetching authenticated judge matches: ${error}`);
        return res.status(500).jsob({
            message: 'Server error while retrieving matches'
        });
    } 
});

router.get('/oralrounds/judge/:judgeID', async (req, res) => {

    const judgeID = Number(req.params.judgeID); 

    try {
        const matchesCollection = getCollection('preliminaryMatches'); 

        const assignedMatches = await matchesCollection.find({
            assignedJudges: judgeID,
        }).toArray();

        const ungradedMatches = assignedMatches.filter(currentMatch => {
            return !currentMatch.gradedJudges || !currentMatch.gradedJudges.includes(judgeID); 
        })

        res.json(ungradedMatches); 

    } catch (error) { 
        console.error(`Error fetching judge matches: ${error}`);
        res.status(500).json({ message: 'Server error while retrieving matches' });
    }

});

router.get('/oralrounds/match/:matchID', requireJudgeAuth,async (req, res) => { 
    const matchID = req.params.matchID; 
    const judgeID = Number(req.authJudgeID);

    try { 
        const matchesCollection = getCollection('preliminaryMatches'); 
        const speakerCollection = getCollection('speakers'); 

        const currentMatch = await matchesCollection.findOne({ matchID: matchID });
        ``
        if (!currentMatch){
            return res.status(404).json({ message: 'Match not found' });
        }

        if (!isJudgeAssignedToMatch(currentMatch, judgeID)){
            return res.status(403).json({
                message: 'Access denied. You are not assigned to this match.'
            });
        }

        if (hasJudgeAlreadyGraded(currentMatch, judgeID)) {
            return res.status(403).json({
                message: 'You have already graded this match.'
            });
        }

        const firstTeam = currentMatch.victimTeam;
        const secondTeam = currentMatch.stateTeam;

        const allSpeakers = await speakerCollection.find({ speakerID: { $in: [`${firstTeam}A`, `${firstTeam}B`, `${secondTeam}A`, `${secondTeam}B`]}}).toArray(); 
        const speakerInfo = allSpeakers.map(currentSpeaker => ({
            speakerID: currentSpeaker.speakerID, 
            speakerName: currentSpeaker.speakerName
        }));

        /* This is saying get the value of matchID in currentMatch and put it in databaseMatchID */ 
        res.json({ matchID, matchDay: currentMatch.matchDay, firstTeam, firstTeamRole: 'Victim', secondTeam, secondTeamRole: 'State', roomNumber: currentMatch.roomNumber, matchTime: currentMatch.matchTime, allSpeakers: speakerInfo });

    } catch (error){
        console.error(`Error retrieving match ${matchID}: ${error}`);
        res.status(500).json({  message: 'Server error while retrieving match' })
    }

});

router.post('/oralrounds/submitscores', requireJudgeAuth,async (req, res) => { 
    const judgeID = Number(req.authJudgeID);
    const { matchID, finalScores } = req.body; 

    if (!Number.isFinite(judgeID) || !matchID || !Array.isArray(finalScores)){ 
        return res.status(400).json({ message: 'Missing required fields' });
    }

    if (finalScores.length !== 4){
        return res.status(400).json({ message: 'Exactly 4 scores must be submitted'});
    }

    try{

        const speakersCollection = getCollection('speakers'); 
        const matchesCollection = getCollection('preliminaryMatches'); 

        for (const { speakerID, finalScore } of finalScores){
            await speakersCollection.updateOne(
                { speakerID }, 
                { $push: { 
                    receivedScores: {
                        judgeID,
                        score: finalScore
                    }
                }
            }
        );
    }

    await matchesCollection.updateOne(
        { matchID },
        { $addToSet: {gradedJudges: judgeID}} 
    )

    res.status(200).json({ message: 'Scores submitted successfully' });

    } catch (error){ 
        console.error('Error submitting scores: ', error); 
        res.status(500).json({ 
            message: 'Server error' 
        });
    }
});

module.exports = router; 