require('dotenv').config(); 
const { MongoClient } = require('mongodb');
const XLSX = require('xlsx');
const path = require('path'); 

async function generateExcel(){ 
    const client = new MongoClient(process.env.MONGODB_URI); 

    try{
        await client.connect(); 
        const db = client.db('IAMOOT-DB'); 
        const judgesCollection = db.collection('judges'); 
        const memorandumsCollection = db.collection('memorandums'); 

        const allJudges = await judgesCollection.find().toArray(); 
        const allMemorandums = await memorandumsCollection.find().toArray();

        /* CREATE MAP WITH FULLNAME AS KEY TO EACH JUDGE */
        const judgeMap = new Map(); 
        allJudges.forEach( (currentJudge) => {
            if (currentJudge.fullName) {
                judgeMap.set(currentJudge.fullName.trim(), currentJudge); 
            }
        });

        const excelData = []; 
        
        /* GATHER THE INFORMATION TO BE PUSHED INTO THE EXCEL FILE */
        allMemorandums.forEach( (currentMemorandum) => {
            if (currentMemorandum.assignedJudges && Array.isArray(currentMemorandum.assignedJudges)){
                currentMemorandum.assignedJudges.forEach( (currentJudgeName) => {
                    const currentJudge = judgeMap.get(currentJudgeName.trim());
                    if (currentJudge){
                        excelData.push({
                            'Memorandum Name': currentMemorandum.name, 
                            'Judge Name': currentJudge.fullName, 
                            'Preferred Language': currentJudge.currentLanguage,
                            'Primary Email': currentJudge.primaryEmail,
                            'Secondary Email': currentJudge.secondaryEmail || '', 
                            'Shared Link': currentMemorandum.sharedLink || '', 
                            'Score (0-100)': '' 
                        })
                    } else {
                        console.warn(`Judge with full name "${currentJudgeName}" not found.`);
                    }
                })
            }
        })

        /* SORT THE INFORMATION ON THE EXCEL BY ALPHABETIC ORDER */
        excelData.sort((firstItem, secondItem) => firstItem['Judge Name'].localeCompare(secondItem['Judge Name']));

        /* CREATE WORKSHEET AND WORKBOOK */
        const finalWorksheet = XLSX.utils.json_to_sheet(excelData);
        const finalWorkbook = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(finalWorkbook, finalWorksheet, 'Judge Assignments'); 

        /* WRITE  TO FILE */
        const outputPath = path.join(__dirname, 'JudgeAssignments.xlsx');
        XLSX.writeFile(finalWorkbook, outputPath);

        console.log(`Excel file created successfully at: ${outputPath}`);

        
    } catch (error){
        console.error(`Error generating Excel file: `, error); 
    } finally {
        await client.close(); 
    }
}

generateExcel(); 