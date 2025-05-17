const XLSX = require('xlsx'); 
const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

/* GET COMMAND LINE ARGUMENTS*/
const filePath = process.argv[2]; 
const currentLanguage = process.argv[3];

if (!filePath || !currentLanguage){
    console.error(`Usage: node scripts/importJudges.js <path_to_file.xlsx> <language_code>`);
    process.exit(1);
}

/* PASSWORD GENERATOR */
function generatePassword(passwordLength = 14){
    const usableCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({length: passwordLength}, () => usableCharacters[Math.floor(Math.random() * usableCharacters.length)]).join('');
}

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try{
        await client.connect(); 
        const db = client.db('ProdCluster');
        const judgeCollection = db.collection('preliminaryJudges'); 

        /* READ EXCEL FILE */
        const workbook = XLSX.readFile(filePath); 
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); 

        /* ADD ID TO THE JUDGES */
        let baseID; 
        if (currentLanguage === 'EN') baseID = 1000; 
        else if (currentLanguage === 'SPA') baseID = 2000; 
        else if (currentLanguage === 'POR') baseID = 3000;
        else {
            console.error(`Invalid language code: ${currentLanguage}`);
            process.exit(1); 
        } 

        const lastJudge = await judgeCollection.find({ currentLanguage }).sort({ judgeID: -1 }).limit(1).toArray(); 
        let nextJudgeID = lastJudge.length > 0 ? lastJudge[0].judgeID + 1 : baseID; 

        /* TRANSFORM DATA */
        const allJudges = rawData.map( currentRow => ({
            judgeID: nextJudgeID++, 
            fullName: currentRow['fullName'], 
            primaryEmail: currentRow['primaryEmail'], 
            secondaryEmail: currentRow['secondaryEmail'], 
            currentPassword: generatePassword(14),
            currentLanguage: currentLanguage,
            currentRole: 'Judge'
        }));

        /* INSERT INTO MONGODB */
        const finalResult = await judgeCollection.insertMany(allJudges); 
        console.log(`Succesfully inserted ${finalResult.insertedCount} judges`);
        
    } catch (err){
        console.error('Error importing judges: ', err); 
    } finally {
        await client.close(); 
    }
}

main();