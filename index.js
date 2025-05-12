require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { MongoClient } = require('mongodb');
const { Dropbox } = require ('dropbox'); 

const app = express(); 
const port = 3000; 

/* DROPBOX SETUP */
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

/* MONGODB SETUP */
const client = new MongoClient(process.env.MONGODB_URI); 
let judgesCollection; 

async function connectToMongoDB(){
    try {
        await client.connect();
        const db = client.db('IAMOOT-DB'); // Create/use this database
        judgesCollection = db.collection('judges'); // Create/use this collection
        console.log(`Connected to MongoDB Atlas`); 
    } catch (err){
        console.error(`Failed to connect to MongoDB: `, err); 
    }
}

connectToMongoDB(); 

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

        const { matchDate } = req.query; 
        const dateFilter = matchDate ? { matchDate } : {}; 

        const allMatches = await matchesCollection.find(dateFilter).toArray(); 
        res.json(allMatches); 
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