const express = require ('express'); 
const router = express.Router(); 
const { getCollection } = require ('../db'); 

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
            firstTeam: teamMap[currentMatch.firstTeam],
            secondTeam: teamMap[currentMatch.secondTeam]
        }));

        res.json(enrichedMatches); 
    } catch (err){
        console.error('Error retrieving matches: ', err); 
        res.status(500).json({ error: 'Internal server error' });
    }

});

module.exports = router; 