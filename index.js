require('dotenv').config(); 
const express = require('express'); 
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

/* ROUTES */
app.get('/', (req, res) => {
    res.send(`Welcome to the IAMOOT Dropbox API`); 
})

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

app.get('/add-test-judge', async (req, res) => {
    try {
        const result = await judgesCollection.insertOne({
            name: "Test Judge", 
            email: "test@example.com", 
            language: "ENG"
        });
        res.send("Judge inserted!");
    } catch (err){
        res.status(500).send(`Error inserting judge`);
    }
})

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
});