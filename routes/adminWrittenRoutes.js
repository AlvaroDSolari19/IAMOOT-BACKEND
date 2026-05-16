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
};

/*********************
 * SUBMISSION STATUS * 
 *********************/
router.get('/admin/written/submissions', async (req, res) => {

    try {

        const teamsCollection = getCollection('teams');

        const allTeams = await teamsCollection.find({}).project({
            _id: 0,
            teamID: 1,
            teamLanguage: 1,
            universityName: 1,
            memorandaSubmission: 1
        }).toArray();

        const submissionRecords = allTeams.map((teamRecord) => {
            const hasSubmittedMemoranda = !!teamRecord.memorandaSubmission;

            return {
                teamID: teamRecord.teamID,
                teamLanguage: teamRecord.teamLanguage,
                universityName: teamRecord.universityName,
                hasSubmittedMemoranda
            }

        })

        submissionRecords.sort((firstTeam, secondTeam) => {
            return Number(firstTeam.teamID) - Number(secondTeam.teamID);
        });

        return res.status(200).json({
            ok: true,
            message: 'Written submission status retrieved successfully.',
            submissions: submissionRecords
        });

    } catch (error) {
        console.error('Written submission status error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve written submission status.' });
    }

});

/***********
 * RESULTS *
 ***********/
router.get('/admin/written/results', async (req, res) => {

    try {

        const teamsCollection = getCollection('teams');
        const memorandaCollection = getCollection('memoranda');

        const allTeams = await teamsCollection.find({}).project({
            _id: 0,
            teamID: 1,
            teamLanguage: 1,
            universityName: 1
        }).toArray();

        const allMemoranda = await memorandaCollection.find({}).project({
            _id: 0,
            teamID: 1,
            status: 1,
            scoresByJudge: 1,
            penaltyPoints: 1
        }).toArray();

        const results = allTeams.map((teamRecord) => {
            const stateMemorandum = allMemoranda.find((memorandumRecord) => {
                return memorandumRecord.teamID === teamRecord.teamID && memorandumRecord.status === 'State';
            });

            const victimMemorandum = allMemoranda.find((memorandumRecord) => {
                return memorandumRecord.teamID === teamRecord.teamID && memorandumRecord.status === 'Victim';
            });

            const rawStateAverage = calculateAverageScore(stateMemorandum?.scoresByJudge); 
            const rawVictimAverage = calculateAverageScore(victimMemorandum?.scoresByJudge); 

            const statePenaltyPoints = Number(stateMemorandum?.penaltyPoints || 0); 
            const victimPenaltyPoints = Number(victimMemorandum?.penaltyPoints || 0); 

            const stateAverage = rawStateAverage !== null ? rawStateAverage - statePenaltyPoints : null;
            const victimAverage = rawVictimAverage !== null ? rawVictimAverage - victimPenaltyPoints : null;
            const combinedAverage = stateAverage !== null && victimAverage !== null ? (stateAverage + victimAverage) / 2 : null;

            return {
                teamID: teamRecord.teamID,
                universityName: teamRecord.universityName,
                teamLanguage: teamRecord.teamLanguage,
                stateAverage,
                victimAverage,
                combinedAverage,
            }

        });

        return res.status(200).json({ ok: true, message: 'Written results retrieved successfully.', results });

    } catch (error) {
        console.error('Written results error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve written results.' });
    }

});

/****************
 * TEAM DETAILS *
 ****************/
router.get('/admin/written/team/:teamID', async (req, res) => {

    try {

        const teamID = String(req.params.teamID || '').trim();
        if (!teamID) return res.status(400).json({ ok: false, message: 'Team ID is required.' });

        const teamsCollection = getCollection('teams');
        const memorandaCollection = getCollection('memoranda');

        const teamRecord = await teamsCollection.findOne(
            { teamID },
            {
                projection: {
                    _id: 0,
                    teamID: 1,
                    teamLanguage: 1,
                    universityName: 1
                }
            }
        );

        if (!teamRecord) return res.status(404).json({ ok: false, message: 'Team was not found.' });

        const memorandaRecords = await memorandaCollection.find({ teamID }).project({
            _id: 0,
            memorandumID: 1,
            teamID: 1,
            status: 1,
            scoresByJudge: 1,
            penaltyPoints: 1
        }).toArray();

        const stateMemorandum = memorandaRecords.find((memorandumRecord) => {
            return memorandumRecord.status === 'State';
        });

        const victimMemorandum = memorandaRecords.find((memorandumRecord) => {
            return memorandumRecord.status === 'Victim';
        });

        const formatMemorandumDetails = (memorandumRecord) => {
            if (!memorandumRecord) return null;

            const scoreValues = Array.isArray(memorandumRecord.scoresByJudge) ? memorandumRecord.scoresByJudge.map((scoreRecord) => {
                return scoreRecord.totalScore; 
            }) : []; 

            const averageScore = calculateAverageScore(memorandumRecord.scoresByJudge);
            const penaltyPoints = Number(memorandumRecord.penaltyPoints || 0);
            const adjustedScore = averageScore !== null ? averageScore - penaltyPoints : null;

            return {
                memorandumID: memorandumRecord.memorandumID,
                status: memorandumRecord.status,
                scoreValues,
                averageScore,
                penaltyPoints,
                adjustedScore
            };
        };

        return res.status(200).json({
            ok: true, 
            message: 'Written team details retrieved successfully.', 
            team: teamRecord, 
            memoranda: { 
                state: formatMemorandumDetails(stateMemorandum), 
                victim: formatMemorandumDetails(victimMemorandum)
            }
        });

    } catch (error) {
        console.error('Written team details error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve written team details.' });
    }

});

/*****************
 * APPLY PENALTY *
 *****************/

router.patch('/admin/written/team/:teamID/penalty', async (req, res) => {

    try {

        const teamID = String(req.params.teamID || '').trim(); 
        const memorandumType = String(req.body.memorandumType || '').trim(); 
        const penaltyPoints = Number(req.body.penaltyPoints); 

        if (!teamID) return res.status(400).json({ ok: false, message: 'Team ID is required.' }); 
        if (!memorandumType) return res.status(400).json({ ok: false, message: 'Memorandum type is required.' });
        if (memorandumType !== 'State' && memorandumType !== 'Victim') return res.status(400).json({ ok: false, message: 'Memorandum type must be State or Victim.' });
        if (Number.isNaN(penaltyPoints) || penaltyPoints <= 0) return res.status(400).json({ ok: false, message: 'Penalty points must be a number greater than 0.' });

        const memorandaCollection = getCollection('memoranda'); 
        const updateResult = await memorandaCollection.updateOne(
            {
                teamID,
                status: memorandumType,
            }, 
            {
                $set: {
                    penaltyPoints
                }
            }
        );

        if (updateResult.matchedCount === 0) return res.status(404).json({ ok: false, message: 'Memorandum was not found.' });

        return res.status(200).json({
            ok: true, 
            message: 'Penalty points applied successfully.'
        });

    } catch (error){
        console.error('Written penalty update error: ', error); 
        return res.status(500).json({ ok: false, message: 'Failed to apply penalty points.' })
    }

});

module.exports = router; 