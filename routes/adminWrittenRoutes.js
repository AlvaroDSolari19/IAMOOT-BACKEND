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

module.exports = router; 