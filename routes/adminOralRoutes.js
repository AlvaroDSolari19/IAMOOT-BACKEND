const express = require('express'); 
const { getCollection } = require('../db'); 

const router = express.Router(); 

/***********************
 * PRELIMINARY MATCHES *
 ***********************/
router.get('/admin/oral/preliminary-matches', async (req, res) => {

    try {

        const preliminaryMatchesCollection = getCollection('preliminaryMatches'); 

        const preliminaryMatches = await preliminaryMatchesCollection.find({}).project({
            _id: 0, 
            matchID: 1, 
            stateTeam: 1, 
            victimTeam: 1, 
            stateTeamUniversity: 1, 
            victimTeamUniversity: 1, 
            matchDay: 1, 
            matchDate: 1, 
            matchTime: 1, 
            roomNumber: 1, 
            winningTeam: 1
        }).sort({
            matchDate: 1, 
            matchTime: 1, 
            matchID: 1
        }).toArray();

        return res.status(200).json({
            ok: true, 
            message: 'Preliminary matches retrieved successfully.',
            preliminaryMatches
        });

    } catch (error){
        console.error('Preliminary matches error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve preliminary matches.'}); 
    }
});

module.exports = router; 