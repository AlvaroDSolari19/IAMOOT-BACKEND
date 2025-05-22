const express = require ('express'); 
const router = express.Router(); 
const { getCollection } = require ('../db'); 

router.get('/admin/speakers', async (req, res) => {
    try {
        const speakersCollection = getCollection('speakers');
        const teamsCollection = getCollection('teams'); 
        
        const requestedLanguage = req.query.language; 
        if (!requestedLanguage){
            return res.status(400).json({ error: 'Missing language parameter' });
        }

        const matchingSpeakers = await speakersCollection
            .find({
                speakerLanguage: requestedLanguage, 
                preliminaryAverageScore: { $exists: true }
            })
            .sort({ preliminaryAverageScore: -1 })
            .toArray(); 

        /* Gets all the teamIDs from matchingSpeakers and stores them in an Array */
        const uniqueTeamIDs = [...new Set(matchingSpeakers.map(speakerDoc => speakerDoc.teamID))];

        /* Goes through all the teams that appear in uniqueTeamIDs and stores them in matchingTeamDocuments */
        const matchingTeamDocuments = await teamsCollection.find({
            teamID: { $in: uniqueTeamIDs }
        }).toArray(); 

        /* Object.fromEntries takes an Array of [key, value] and turns it into an Object */
        const teamIDToSchoolNameMap = Object.fromEntries(
            matchingTeamDocuments.map(teamDoc => [teamDoc.teamID, teamDoc.universityName])
        );

        const enrichedSpeakerList = matchingSpeakers.map(speakerDoc => ({
            ...speakerDoc, 
            speakerSchool: teamIDToSchoolNameMap[speakerDoc.teamID] || 'Unknown'
        }));

        res.json(enrichedSpeakerList); 

    } catch (err) {
        console.error('Error fetching speaker rankings: ', err); 
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/preliminary-matches', async(req, res) => {

    try {
        const matchesCollection = getCollection('preliminaryMatches'); 
        const teamsCollection = getCollection('teams'); 

        const { matchDate } = req.query; 
        const dateFilter = matchDate ? { matchDate } : {}; 

        const allMatches = await matchesCollection.find(dateFilter).toArray(); 

        /* Fetch all the teams and create a lookup map */
        const allTeams = await teamsCollection.find({}).toArray(); 
        const teamMap = {};
        for (const currentTeam of allTeams){
            teamMap[currentTeam.teamID] = currentTeam.universityName;
        }

        /* Replace team IDs in each match with school names */
        const enrichedMatches = allMatches.map(currentMatch => ({
            ...currentMatch,
            firstTeamName: teamMap[currentMatch.firstTeam],
            secondTeamName: teamMap[currentMatch.secondTeam]
        }));

        res.json(enrichedMatches); 
    } catch (err){
        console.error('Error retrieving matches: ', err); 
        res.status(500).json({ error: 'Internal server error' });
    }

});

router.get('/admin/preliminary-matches/:matchID', async (req, res) => {

    try {

        const matchID = String(req.params.matchID);
        const matchesCollection = getCollection('preliminaryMatches'); 
        const teamsCollection = getCollection('teams');

        const currentMatch = await matchesCollection.findOne({ matchID }); 

        if (!currentMatch){
            return res.status(404).json({ message: 'Match not found' });
        }

        const allTeams = await teamsCollection.find({}).toArray(); 
        const teamMap = {}; 
        for (const currentTeam of allTeams){
            teamMap[currentTeam.teamID] = currentTeam.universityName; 
        }

        const enrichedMatch = {
            ...currentMatch,
            firstTeamName: teamMap[currentMatch.firstTeam],
            secondTeamName: teamMap[currentMatch.secondTeam]
        }

        res.json(enrichedMatch); 
    } catch (err) {
        console.error('Error retrieving match by ID: ', err); 
        res.status(500).json({ error: 'Internal server error' });
    }

});

router.patch('/admin/preliminary-matches/:matchID', async (req, res) => {
    try {

        const matchID = String(req.params.matchID); 
        const { matchWinner } = req.body; 

        if (!matchWinner){
            return res.status(400).json({ message: 'Winner is required' });
        }

        const matchesCollection = getCollection('preliminaryMatches'); 

        const mongoResult = await matchesCollection.updateOne(
            { matchID: matchID }, 
            { $set: { matchWinner } }
        );

        if (mongoResult.matchedCount === 0){
            return res.status(404).json({ message: 'Match not found' });
        }

        res.json({ message: `matchWinner updated to ${matchWinner}`})

    } catch (err){
        console.error('Error updating match winner: ', err);
        res.status(500).json({ error: 'Internal server error' }); 
    }
});

module.exports = router; 