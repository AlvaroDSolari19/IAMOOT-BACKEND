const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db');

router.get('/admin/semifinal-matches', async (req, res) => {
    try {
        const matchesCollection = getCollection('preliminaryMatches');
        const teamsCollection = getCollection('teams');

        const semifinalMatchIDs = [
            "100", "101", "102", "103", "104", "105", "106", 
            "107", "108", "109", "110", "111", "112"
        ]

        const semifinalMatches = await matchesCollection.find({ matchID: { $in: semifinalMatchIDs } }).toArray(); 
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

router.get('/admin/semi-team-rankings', async(req, res) => {
    try {
        const semiTeamsCollection = getCollection('semiTeams'); 
        const allTeams = await semiTeamsCollection.find({}).toArray(); 
        res.json(allTeams); 
    } catch (err) {
        console.error('Error fetching semi team rankings: ', err); 
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router; 