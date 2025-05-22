const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db');

router.get('/admin/semifinal-matches', async (req, res) => {
    try {
        const matchesCollection = getCollection('preliminaryMatches');
        const teamsCollection = getCollection('teams');

        const semifinalMatches = await matchesCollection.find({ matchID: { $gte: 100 } }).toArray(); 
        const allTeams = await teamsCollection.find({}).toArray(); 

        const teamMap = {}; 
        for (const currentTeam of allTeams){
            teamMap[currentTeam.teamID] = currentTeam.universityName; 
        }

        const enrichedMatches = semifinalMatches.map(currentMatch => ({
            ...currentMatch,
            firstTeamName: teamMap[currentMatch.firstTeam],
            secondTeamName: teamMap[currentMatch.secondTeam]
        }));

        res.json(enrichedMatches); 

    } catch (err){
        console.error('Error fetching semifinal matches: ', err); 
        res.status(500).json({ error: 'Internal server error'});
    }
})

module.exports = router; 