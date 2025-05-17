const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db');

router.get('/admin/teams', async (req, res) => {
    
    try {
        const teamsCollection = getCollection('teams'); 
        const sortedTeams = await teamsCollection
            .find({})
            .sort({ preliminaryWins: -1, averageMemoScore: -1})
            .toArray(); 
        res.json(sortedTeams); 
    } catch (err) {
        console.error('Error fetching teams: ', err);
        res.status(500).json({ error: 'Internal server error'}); 
    }

})

module.exports = router; 