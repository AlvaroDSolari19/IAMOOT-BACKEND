const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db');

router.get('/admin/teams', async (req, res) => {
    
    try {
        const teamsCollection = getCollection('teams'); 
        const allTeams = await teamsCollection.find({}).toArray(); 
        //Sorting logic: In this case, we need to sort by number of victories and then by memorandum score
        res.json(allTeams); 
    } catch (err) {
        console.error('Error fetching teams: ', err);
        res.status(500).json({ error: 'Internal server error'}); 
    }

})

module.exports = router; 