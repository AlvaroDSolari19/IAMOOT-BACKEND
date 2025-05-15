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
        const speakerCollection = getCollection('speakers'); 

        const currentMatch = await matchesCollection.findOne({ matchID: matchID });

        if (!currentMatch){
            return res.status(404).json({ message: 'Match not found' });
        }

        const { firstTeam, secondTeam } = currentMatch;

        const allSpeakers = await speakerCollection.find({ speakerID: { $in: [`${firstTeam}A`, `${firstTeam}B`, `${secondTeam}A`, `${secondTeam}B`]}}).toArray(); 
        const speakerInfo = allSpeakers.map(currentSpeaker => ({
            speakerID: currentSpeaker.speakerID, 
            speakerName: currentSpeaker.speakerName
        }));

        /* This is saying get the value of matchID in currentMatch and put it in databaseMatchID */ 
        res.json({ matchID, firstTeam, secondTeam, allSpeakers: speakerInfo})

    } catch (error){
        console.error(`Error retrieving match ${matchID}: ${error}`);
        res.status(500).json({  message: 'Server error while retrieving match' })
    }

})

module.exports = router; 