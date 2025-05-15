const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db'); 

router.get('/oralrounds/judge/:judgeID', async (req, res) => {

    const judgeID = Number(req.params.judgeID); 

    try {
        const matchesCollection = getCollection('preliminaryMatches'); 

        const assignedMatches = await matchesCollection.find({
            judgesAssigned: judgeID
        }).toArray();

        res.json(assignedMatches); 

    } catch (error) { 
        console.error(`Error fetching judge matches: ${error}`);
        res.status(500).json({ message: 'Server error while retrieving matches' });
    }

});

router.get('/oralrounds/match/:matchID', async (req, res) => { 
    const matchID = req.params.matchID; 

    try { 
        const matchesCollection = getCollection('preliminaryMatches'); 
        const currentMatch = await matchesCollection.findOne({ matchID: matchID });
        if (!currentMatch){
            return res.status(404).json({ message: 'Match not found' });
        }

        /* This is saying get the value of matchID in currentMatch and put it in databaseMatchID */ 
        const { matchID: databaseMatchID, firstTeam, secondTeam } = currentMatch;
        res.json({ matchID: databaseMatchID, firstTeam, secondTeam })

    } catch (error){
        console.error(`Error retrieving match ${matchID}: ${error}`);
        res.status(500).json({  message: 'Server error while retrieving match' })
    }

})

module.exports = router; 