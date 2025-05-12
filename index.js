require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { Dropbox } = require ('dropbox'); 
const { connectToMongoDB } = require('./db'); 

const loginRoute = require('./routes/login');

const app = express(); 
const port = 3000; 

connectToMongoDB();

/* DROPBOX SETUP */
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

/* MIDDLEWARE */
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json()); 

/* ROUTES */
app.use('/api', loginRoute); 

app.get('/api/preliminary-matches', async (req, res) => {
    try {
        const db = client.db('IAMOOT-DB');
        const matchesCollection = db.collection('preliminaryMatches'); 
        const teamsCollection = db.collection('teams'); 

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
})

/* DROPBOX API */
app.get('/files', async (req, res) => {
    try{
        const folderPath = '/IAMOOT 2025'; 
        const listResponse = await dbx.filesListFolder({ path: folderPath}); 

        res.json(listResponse.result.entries); 

    } catch (error) {
        console.error(`Error fetching files from Dropbox: `, error); 
        res.status(500).json({error: 'Could not fetch files from Dropbox'})
    }
})

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
});