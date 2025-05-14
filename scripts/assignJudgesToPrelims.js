require('dotenv').config(); 
const { MongoClient } = require('mongodb'); 

const client = new MongoClient(process.env.MONGODB_URI); 

function getJudgeCountForMatch(someLanguage){
    if (someLanguage === 'English') return 7; 
    if (someLanguage === 'Portuguese') return (Math.random() < 0.5 ? 3 : 5); 
    if (someLanguage === 'Spanish') return (Math.random() < 0.5 ? 7 : 9);
}

async function main() { 
    try {

        await client.connect(); 
        const db = client.db('IAMOOT-DB');

        const matchesCollection = db.collection('preliminaryMatches'); 
        const judgesCollection = db.collection('preliminaryJudges');

        const allMatches = await matchesCollection.find().toArray(); 
        console.log(`Loaded ${allMatches.length} matches.`);

        const allJudges = await judgesCollection.find().toArray();
        console.log(`Loaded ${allJudges.length} judges.`);
        console.log(); 

        /****************************
         * GROUP JUDGES BY LANGUAGE *
         ****************************/
        const judgePools = {
            English: [],
            Spanish: [],
            Portuguese: []
        };

        for (const currentJudge of allJudges) {
            const currentID = currentJudge.judgeID;

            if (currentID >= 1000 && currentID < 2000){
                judgePools.English.push(currentJudge); 
            } else if (currentID >= 2000 && currentID < 3000){
                judgePools.Spanish.push(currentJudge);
            } else if (currentID >= 3000 && currentID < 4000){
                judgePools.Portuguese.push(currentJudge); 
            }

        }

        console.log(`Judge Pools:\n - English: ${judgePools.English.length}\n - Spanish: ${judgePools.Spanish.length}\n - Portuguese: ${judgePools.Portuguese.length}`);
        console.log(); 

        /*******************************
         * TRACK THE MATCHES PER JUDGE *
         *******************************/
        const judgeAssignments = {};

        for (const currentLanguage in judgePools){
            for (const currentJudge of judgePools[currentLanguage]){
                judgeAssignments[currentJudge.judgeID] = 0; 
            }
        }

        console.log(`Tracking assignments for ${Object.keys(judgeAssignments).length} judges.`);
        console.log(); 

        /**********************************************
         * LOOP THROUGH THE MATCHES AND ASSIGN JUDGES *
         **********************************************/
        for (const currentMatch of allMatches){
            const matchID = currentMatch.matchID; 
            const matchNumber = parseInt(matchID, 10); 

            let matchLanguage = ''; 
            if (matchNumber >= 1 && matchNumber <= 6){
                matchLanguage = 'English';
            } else if (matchNumber >= 7 && matchNumber <= 39){
                matchLanguage = 'Spanish'; 
            } else if (matchNumber >= 40 && matchNumber <= 49){
                matchLanguage = 'Portuguese'; 
            } else {
                console.warn(`Invalid matchID: ${matchID}, skipping...`)
                continue; 
            }

            /* Decide the number of judges for currentMatch */
            const requiredCount = getJudgeCountForMatch(matchLanguage); 
            const judgePool = judgePools[matchLanguage];

            /* Shuffle the judge pool */
            const shuffledJudges = [...judgePool].sort(() => Math.random() - 0.5); 

            /* Sort the shuffled list by fewest assignments */
            const sortedJudges = shuffledJudges.sort((judgeA, judgeB) => {
                return judgeAssignments[judgeA.judgeID] - judgeAssignments[judgeB.judgeID]; 
            });

            /* Select the required number of judges from the sortedJudges */
            const topCandidates = sortedJudges.slice(0, requiredCount);
            const selectedJudgesIDs = topCandidates.map(judgeObject => {
                return judgeObject.judgeID;
            })

            /* Add the judgeIDs to the currentMatch */
            currentMatch.judgesAssigned = selectedJudgesIDs; 

            /* Update the assignment count for each of the judgesAssigned */
            for (const judgeID of selectedJudgesIDs){
                judgeAssignments[judgeID]++; 
            }

        }

        /**************
         * VALIDATION *
         **************/
        let allJudgesValid = true; 
        let allMatchesValid = true; 

        /* Validate that every judge has at least 2 assignments */
        console.log('Judges with fewer than 2 assignments: ');
        for (const [judgeID, assignmentCount] of Object.entries(judgeAssignments)){
            if (assignmentCount < 2){
                console.warn(`Judge ${judgeID} only assigned to ${assignmentCount} match(es)`);
                allJudgesValid = false; 
            }
        }
        console.log();

        /* Validate that every match has an odd number of judges */
        console.log('Matches with non-odd number of judges: ');
        for (const currentMatch of allMatches){
            const assignmentCount = currentMatch.judgesAssigned?.length || 0; 

            if (assignmentCount % 2 === 0 || assignmentCount < 3 || assignmentCount > 9){
                console.warn(`Match ${currentMatch.matchID} has invalid judge count: ${assignmentCount}`);
                allMatchesValid = false; 
            }
        }
        console.log(); 

        /* Final validation summary */
        if (allJudgesValid && allMatchesValid){
            console.log('All judges have at least 2 assignments and all matches have valid judge counts.');
            console.log(); 
        } else {
            console.log('Validation issues found. Please review the warnings above.'); 
            console.log(); 
        }

        /***********************
         * WRITING TO DATABASE *
         ***********************/
        let successfulWrites = 0; 
        let failedWrites = 0; 

        for (const currentMatch of allMatches){
            const matchID = currentMatch.matchID; 
            const judgeIDs = currentMatch.judgesAssigned; 

            try {
                const matchUpdateResult = await matchesCollection.updateOne(
                    { matchID: matchID },
                    { $set: { judgesAssigned : judgeIDs } }
                );

                if (matchUpdateResult.modifiedCount === 1){
                    console.log(`Updated match ${matchID} with ${judgeIDs.length} judges.`);
                    successfulWrites++;
                } else {
                    console.warn(`No document modified for match ${matchID}`);
                }

            } catch (err){
                console.error(`Error updating match ${matchID}: `, err.message);
                failedWrites++;
            }
        }

        console.log(`\n Judge assignemnt update complete: `);
        console.log(` - Successful updates: ${successfulWrites}`);
        console.log(` - Failed updates: ${failedWrites}`);

        await client.close(); 

    } catch (err) {
        console.error('Error: ', err); 
    }
}

main(); 