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
    const client = new MongoClient(process.env.MONGODB_URI); 

    try{
        await client.connect(); 
        const db = client.db('IAMOOT-DB');
        const collection = db.collection('judges'); 

        /* READ EXCEEL FILES */
        const workbook = XLSX.readFile(filePath); 
        const sheetName = workbook.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]); 

        /* TRANSFORM DATA */
        const allJudges = rawData.map( currentRow => ({
            fullName: currentRow['fullName'], 
            primaryEmail: currentRow['primaryEmail'], 
            secondaryEmail: currentRow['secondaryEmail'], 
            currentPassword: generatePassword(14),
            oralRounds: currentRow['oralRounds'], 
            currentLanguage: currentLanguage,
            currentRole: 'Judge'
        }));

        /* INSERT INTO MONGODB */
        const finalResult = await collection.insertMany(allJudges); 
        console.log(`Succesfully inserted ${finalResult.insertedCount} judges`);
        
    } catch (err){
        console.error('Error importing judges: ', err); 
    } finally {
        await client.close(); 
    }
}

main();