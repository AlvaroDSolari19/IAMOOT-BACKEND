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

module.exports = router; 