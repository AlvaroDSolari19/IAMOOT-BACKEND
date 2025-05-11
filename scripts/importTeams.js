const XLSX = require('xlsx'); 
const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

/* GET COMMAND LINE ARGUMENTS*/
const filePath = process.argv[2]; 

if (!filePath){
    console.error(`Usage: node scripts/importTeams.js <path_to_file.xlsx>`);
    process.exit(1);
}

async function main(){

    const client = new MongoClient(process.env.MONGODB_URI);

    try {
        await client.connect(); 
        const db = client.db('IAMOOT-DB');
        const collection = db.collection('teams'); 

        /* READ EXCEL FILES */
        const workbook = XLSX.readFile(filePath); 
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        /* TRANSFORM DATA */
        const allTeams = rawData.map( currentRow => ({
            teamID: currentRow['TeamNumber'],
            universityName: currentRow['University'],
            teamLanguage: currentRow['Language'],
            teamMembers: [{firstMember: 'Somebody'}, {secondMember: 'Someone'}],  
            preliminaryWins: 0, 
            preliminaryLosses: 0, 
            averageMemoScore: 0, 
            advancedRound: false
        }));

        /* INSERT INTO MONGODB */
        const finalResult = await collection.insertMany(allTeams);
        console.log(`Successfully inserted ${finalResult.insertedCount} teams`);

    } catch (err){
        console.error('Error importing teams: ', err);
    } finally {
        await client.close();
    }

}

main(); 