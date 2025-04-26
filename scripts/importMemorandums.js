require('dotenv').config(); 
const { MongoClient } = require('mongodb'); 
const Dropbox = require('dropbox').Dropbox; 
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/* LOAD ENVIRONMENT VARIABLES */
const MONGODB_URI = process.env.MONGODB_URI; 
const DB_NAME = 'IAMOOT-DB'
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const DROPBOX_FOLDER_PATH = '/IAMOOT 2025';

/* INITIALIZE DROPBOX */
const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN, fetch});

/* CREATE A SHARED DOCUMENT PERMANENT LINK FOR THE FILE */
async function getSharedLink(path_lower){
    try {
        const existingLinks = await dbx.sharingListSharedLinks({path: path_lower, direct_only: true });
        if (existingLinks.result.links.length > 0){
            return existingLinks.result.links[0].url; 
        } else {
            const newLink = await dbx.sharingCreateSharedLinkWithSettings({ path: path_lower });
            return newLink.result.url; 
        }
    } catch (error) {
        console.error(`Error getting/creating shared link for: `, path_lower, error);
        throw error; 
    }
}

/* FETCH MEMORANDUMS FROM DROPBOX */
async function fetchMemorandumsFromDropbox(){ 
    try {
        const response = await dbx.filesListFolder({ path: DROPBOX_FOLDER_PATH});
        const allFiles = response.result.entries.filter(entry => entry['.tag'] === 'file'); 

        const allMemorandums = await Promise.all(allFiles.map(async (currentFile) => {
            const sharedLink = await getSharedLink(currentFile.path_lower);
            const shortName = currentFile.name.slice(0, 4); 
            
            const numberPart = parseInt(shortName);
            let currentLanguage = 'Unknown'; 
            if ( (numberPart > 100 && numberPart < 130) || (numberPart > 200 && numberPart < 230) ){
                currentLanguage = 'EN'; 
            } else if ( (numberPart >= 130 && numberPart < 170) || (numberPart >= 230 && numberPart < 270)){
                currentLanguage = 'SPA';
            } else if ( (numberPart >= 170 && numberPart < 200) || (numberPart >= 270 && numberPart < 300)){
                currentLanguage = 'POR';
            }

            let currentStatus = 'Unknown'; 
            if (shortName.includes('V')){
                currentStatus = 'Victim';
            } else if (shortName.includes('E') || shortName.includes('S')){
                currentStatus = 'State'; 
            }

            return {
                name: shortName, 
                language: currentLanguage, 
                status: currentStatus, 
                minimumJudges: 5,
                sharedLink: sharedLink
            };

        }));

        return allMemorandums; 

    } catch (error) {
        console.error(`Error fetching memorandums from Dropbox: `, error);
        throw error; 
    }
}

/* SAVE MEMORANDUMS INTO MONGO DB */
async function saveMemorandumsToMongoDB(allMemorandums){
    const client = new MongoClient(MONGODB_URI); 
    try {
        await client.connect(); 
        const db = client.db(DB_NAME); 
        const collection = db.collection('memorandums'); 

        const result = await collection.insertMany(allMemorandums);
        console.log(`Inserted ${result.insertedCount} memorandums.`);
    } catch (error) { 
        console.error(`Error saving memorandums to MongoDB: `, error); 
    } finally {
        await client.close(); 
    }
}

async function main(){
    try {
        console.log(`Fetching memorandums from Dropbox...`); 
        const allMemorandums = await fetchMemorandumsFromDropbox(); 

        console.log(`Saving memorandums to MongoDB`);
        await saveMemorandumsToMongoDB(allMemorandums); 
        
        console.log(`Done!`);
    } catch (error) {
        console.error(`Script failed: `, error);
    }
}

main(); 