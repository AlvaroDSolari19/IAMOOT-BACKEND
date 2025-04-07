require('dotenv').config(); 
const express = require('express'); 
const { Dropbox } = require ('dropbox'); 
const app = express(); 
const port = 3000; 

const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

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

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`)
});