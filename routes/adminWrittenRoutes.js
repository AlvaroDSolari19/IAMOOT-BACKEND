const express = require('express'); 
const { getCollection } = require('../db'); 

const router = express.Router(); 

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
        })

    } catch (error) {
        console.error('Written submission status error: ', error); 
        return res.status(500).json({ok: false, message: 'Failed to retrieve written submission status'});
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
            scoresByJudge: 1
        }).toArray(); 

        const calculateAverageScore = (scoresByJudge) => {
            if (!Array.isArray(scoresByJudge) || scoresByJudge.length === 0) return null; 

            const totalScoreSum = scoresByJudge.reduce((sum, currentScore) => {
                return sum + Number(currentScore.totalScore || 0)
            }, 0);

            return totalScoreSum / scoresByJudge.length; 
        }

        const results = allTeams.map((teamRecord) => {
            const stateMemorandum = allMemoranda.find((memorandumRecord) => {
                return memorandumRecord.teamID === teamRecord.teamID && memorandumRecord.status === 'State'; 
            })

            const victimMemorandum = allMemoranda.find((memorandumRecord) => {
                return memorandumRecord.teamID === teamRecord.teamID && memorandumRecord.status === 'Victim'; 
            })

            const stateAverage = calculateAverageScore(stateMemorandum?.scoresByJudge); 
            const victimAverage = calculateAverageScore(victimMemorandum?.scoresByJudge);
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

        return res.status(200).json({ok: true, message: 'Written results retrieved successfully', results})

    } catch (error) {
        console.error('Written results error: ', error);
        return res.status(500).json({ok: false, message: 'Failed to retrieve written results'});
    }

});

module.exports = router; 