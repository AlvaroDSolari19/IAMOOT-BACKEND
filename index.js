require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { Dropbox } = require ('dropbox'); 
const { connectToMongoDB } = require('./db'); 

const app = express(); 
const port = 3000; 

connectToMongoDB();

/* DROPBOX SETUP */
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

/* MIDDLEWARE */
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json()); 

/* ROUTES */
app.get('/', (req, res) => {
    res.send(`Welcome to the IAMOOT Dropbox API`); 
})

app.post('/api/login', async (req, res) => {

    const { userEmail, userPass } = req.body;

    try {
        
        /* Search for currentJudge by userEmail while case insensitive by using a regex expression. */
        const currentJudge = await judgesCollection.findOne({
            primaryEmail: { $regex: `^${userEmail}$`, $options: 'i' }
        });

        /* If the currentJudge was not found by the email provided, return an error code of 401. */
        if (!currentJudge) { 
            return res.status(401).json({ message: 'Invalid email' });
        }

        /* If currentJudge.currentPassword does not match what was in the req.body.userPass, then return an error code of 401. */
        if (currentJudge.currentPassword !== userPass){
            return res.status(401).json({ message: 'Invalid password' });
        }

        res.json({
            currentName: currentJudge.fullName, 
            currentRole: currentJudge.currentRole,  
        })


    } catch (err) {
        console.error('Login error:', err); 
        res.status(500).json({ message: 'Server error' });
    }

})

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