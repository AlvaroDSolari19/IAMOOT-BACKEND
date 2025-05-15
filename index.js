require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { Dropbox } = require ('dropbox'); 
const { connectToMongoDB } = require('./db'); 

const loginRoute = require('./routes/login');
const adminTeamsRoute = require('./routes/adminTeams');
const adminPrelimsRoute = require('./routes/adminPrelims'); 
const judgeOralRoundsRoutes = require('./routes/judgeOralRounds')

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
app.use('/api', adminTeamsRoute); 
app.use('/api', adminPrelimsRoute); 
app.use('/api', judgeOralRoundsRoutes);

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