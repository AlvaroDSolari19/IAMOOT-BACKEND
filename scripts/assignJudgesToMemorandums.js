require('dotenv').config(); 
const { MongoClient } = require('mongodb'); 

/* LOAD ENVIRONMENT VARIABLES */ 
const MONGODB_URI = process.env.MONGODB_URI; 
const DB_NAME = 'IAMOOT-DB'; 

async function main() {
    const client = new MongoClient(MONGODB_URI); 

    try {
        await client.connect(); 
        const db = client.db(DB_NAME); 

        const judgesCollection = db.collection('judges'); 
        const memorandumsCollection = db.collection('memorandums');
        
        const allJudges = await judgesCollection.find({}).toArray(); 
        const allMemorandums = await memorandumsCollection.find({}).toArray();

        console.log(`Fetched ${allJudges.length} judges and ${allMemorandums.length} memorandums.`);

        /* GROUP JUDGES BY LANGUAGE */
        const judgesByLanguage = {}; 
        
        for (const currentJudge of allJudges){
            const currentLanguage = currentJudge.currentLanguage; 

            if(!judgesByLanguage[currentLanguage]) {
                judgesByLanguage[currentLanguage] = [];
            }

            judgesByLanguage[currentLanguage].push({
                ...currentJudge, 
                assignedMemorandums: [],
            });
            
        }

        /* GROUP MEMORANDUMS BY LANGUAGE */
        const memorandumsByLanguage = {}; 

        for (const currentMemorandum of allMemorandums){
            const currentLanguage = currentMemorandum.language; 
            
            if(!memorandumsByLanguage[currentLanguage]){
                memorandumsByLanguage[currentLanguage] = []; 
            }

            memorandumsByLanguage[currentLanguage].push({
                ...currentMemorandum,
                assignedJudges: [],
            })
        }

        console.log(`Judges and memorandums grouped by language.`);

        /* ASSIGNMENT LOGIC */
        const MIN_JUDGES_PER_MEMORANDUM = 5; 
        const MIN_MEMORANDUMS_PER_JUDGE = 2; 
        const MAX_MEMORANDUMS_PER_JUDGE = 6; 

        function shuffleArray(someArray){
            return someArray.sort(() => Math.random() - 0.5); 
        }

        for (const currentLanguage of Object.keys(memorandumsByLanguage)){
            const groupedMemorandums = memorandumsByLanguage[currentLanguage];
            const groupedJudges = judgesByLanguage[currentLanguage]

            if (!groupedJudges || groupedJudges.length === 0){
                console.warn(`No judges avaiable for language: ${currentLanguage}`); 
                continue; 
            }

            for (const currentMemorandum of groupedMemorandums){
                const availableJudges = groupedJudges.filter(currentJudge => currentJudge.assignedMemorandums.length < MAX_MEMORANDUMS_PER_JUDGE);

                const shuffledJudges = shuffleArray([...availableJudges]);
                const numJudgesToAssign = Math.min(MIN_JUDGES_PER_MEMORANDUM, shuffledJudges.length);
                const selectedJudges = shuffledJudges.slice(0, numJudgesToAssign); 

                if (numJudgesToAssign < MIN_JUDGES_PER_MEMORANDUM){
                    console.warn(`Only assigned ${numJudgesToAssign} judges to memorandum ${currentMemorandum.name} in ${currentLanguage}.`);
                }

                for (const currentJudge of selectedJudges){
                    currentJudge.assignedMemorandums.push(currentMemorandum.name);
                    currentMemorandum.assignedJudges.push(currentJudge.fullName); 
                }

            }
            
        }

        /* ENFORCE AT LEAST 2 MEMORANDUMS PER JUDGE */
        for (const currentLanguage of Object.keys(judgesByLanguage)) {
            const groupedJudges = judgesByLanguage[currentLanguage];
            const groupedMemorandums = memorandumsByLanguage[currentLanguage];

            for (const currentJudge of groupedJudges){

                while (currentJudge.assignedMemorandums.length < MIN_MEMORANDUMS_PER_JUDGE){

                    /* Try memorandums with fewer than 5 judges */
                    let availableMemorandums = groupedMemorandums.filter(currentMemorandum => 
                        !currentJudge.assignedMemorandums.includes(currentMemorandum.name) && currentMemorandum.assignedJudges.length < MIN_JUDGES_PER_MEMORANDUM
                    );

                    /* If none have fewer than 5, pick ANY memorandum on the currentLanguage group */
                    if (availableMemorandums.length === 0){
                        availableMemorandums = groupedMemorandums.filter(currentMemorandum => 
                            !currentJudge.assignedMemorandums.includes(currentMemorandum.name)
                        )
                    }

                    /* If the judge is already in such memorandum, then there is no memorandums left to be assigned to */
                    if (availableMemorandums.length === 0){
                        console.warn(`No memorandums left at all to assign for judge ${currentJudge.fullName} (${currentLanguage}).`);
                        break; 
                    }

                    const randomMemorandum = availableMemorandums[Math.floor(Math.random() * availableMemorandums.length)];
                    currentJudge.assignedMemorandums.push(randomMemorandum.name); 
                    randomMemorandum.assignedJudges.push(currentJudge.fullName); 

                }

            }
        }

        /* SAVE THE UPDATES TO THE MEMORANDUMS AND JUDGES INTO MONGO DB */
        for (const currentLanguage of Object.keys(judgesByLanguage)) {
            const groupedJudges = judgesByLanguage[currentLanguage]; 
            for (currentJudge of groupedJudges){
                await judgesCollection.updateOne(
                    { primaryEmail: currentJudge.primaryEmail },
                    { $set: { assignedMemorandums: currentJudge.assignedMemorandums } }
                );
            }
        }

        for (const currentLanguage of Object.keys(memorandumsByLanguage)) {
            const groupedMemorandums = memorandumsByLanguage[currentLanguage];
            for (const currentMemorandum of groupedMemorandums){
                await memorandumsCollection.updateOne(
                    { name: currentMemorandum.name },
                    { $set: { assignedJudges: currentMemorandum.assignedJudges } }
                );
            }
        }

        console.log(`Successfully saved all assignments into MongoDB.`);

    } catch (error) {
        console.error(`Error connecting to MongoDB or fetching collections: `, error);
    } finally {
        await client.close(); 
    }
}

main(); 