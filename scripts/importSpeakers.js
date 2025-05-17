const XLSX = require('xlsx'); 
const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

/* GET COMMAND LINE ARGUMENTS */
const filePath = process.argv[2];
const languageCode = process.argv[3]?.toUpperCase(); 

if (!filePath || !languageCode){
    console.error(`Usage: node scripts/importSpeakers.js <path_to_excel_file> <EN|SPA|POR`); 
    process.exit(1); 
}

const validCodes = ['EN', 'SPA', 'POR']; 
if (!validCodes.includes(languageCode)){
    console.error(`Invalid language code. Use EN, SPA, or POR.`); 
    process.exit(1); 
}

async function main(){
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {
        await client.connect(); 
        const db = client.db('ProdCluster');
        const speakersCollection = db.collection('speakers'); 
        
        /* READ EXCEL FILE */
        const workbook = XLSX.readFile(filePath); 
        const sheetName = workbook.Sheets[workbook.SheetNames[0]];
        const speakerEntries = XLSX.utils.sheet_to_json(sheetName); 

        const allSpeakers = []; 

        for (const currentEntry of speakerEntries){
            const teamNumber = Number(currentEntry.teamNumber);
            const participantA = currentEntry.participantA?.trim(); 
            const participantB = currentEntry.participantB?.trim(); 

            if (!isNaN(teamNumber) && participantA){
                allSpeakers.push({
                    teamID: teamNumber, 
                    speakerID: `${teamNumber}A`, 
                    speakerName: participantA, 
                    speakerLanguage: languageCode, 
                    receivedScores: []
                });
            }

            if (!isNaN(teamNumber) && participantB){
                allSpeakers.push({
                    teamID: teamNumber, 
                    speakerID: `${teamNumber}B`,
                    speakerName: participantB, 
                    speakerLanguage: languageCode, 
                    receivedScores: []
                });
            }
        }

        /* SORT ARRAY SO THAT IT IS INSERTED BY TEAM ID PER LANGUAGE */
        allSpeakers.sort((speakerOne, speakerTwo) => speakerOne.teamID - speakerTwo.teamID); 

        /* SEND INTO THE DATABASE */
        const finalResult = await speakersCollection.insertMany(allSpeakers); 
        console.log(`Inserted ${finalResult.insertedCount} speakers succeesfully`); 

    } catch (error){
        console.error(`Error importing speakers: ${error}`);
    } finally {
        await client.close(); 
    }
}

main(); 