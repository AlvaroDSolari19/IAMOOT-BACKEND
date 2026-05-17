const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

const roomJudgeLimits = {
    NT01: 9, 
    NT07: 9, 
    NT08: 9, 
    YT17: 9, 
    Y400: 9, 
    Y401: 9, 
    CT16: 5, 
    CT17: 5, 
    C117: 5, 
};

function groupJudgesByLanguage(preliminaryJudges){
    
    const judgesByLanguage = {
        EN: [], 
        SPA: [], 
        POR: []
    }; 

    for (const currentJudge of preliminaryJudges){
        const judgeLanguage = currentJudge.currentLanguage; 

        if(!judgesByLanguage[judgeLanguage]){
            judgesByLanguage[judgeLanguage] = []; 
        }

        judgesByLanguage[judgeLanguage].push(currentJudge);
    }

    return judgesByLanguage;

}

function createJudgeAssignmentTrackers(preliminaryJudges){

    const judgeAssignmentTrackers = {}; 

    for (const currentJudge of preliminaryJudges){
        judgeAssignmentTrackers[currentJudge.judgeID] = {
            judgeID: currentJudge.judgeID, 
            judgeName: currentJudge.fullName, 
            judgeLanguage: currentJudge.currentLanguage, 
            assignmentCount: 0, 
            assignedTimeSlots: []
        }
    }

    return judgeAssignmentTrackers; 

}

function createMatchTimeSlotIdentifier(currentMatch){
    return `${currentMatch.matchDate}|${currentMatch.matchTime}`; 
}

function getRequiredJudgeCount(currentMatch){
    
    const requiredJudgeCount = roomJudgeLimits[currentMatch.roomNumber];
    
    if (!requiredJudgeCount){
        throw new Error(`No judge count configured for room ${currentMatch.roomNumber}`);
    }

    return requiredJudgeCount; 
}

function getJudgeLanguageRequirements(currentMatch, requiredJudgeCount){
    
    if (currentMatch.needsTranslation !== true){
        return {
            [currentMatch.stateTeamLanguage]: requiredJudgeCount
        };
    }

    const matchLanguages = [...currentMatch.matchLanguages].sort(); 
    const firstLanguage = matchLanguages[0];
    const secondLanguage = matchLanguages[1]; 

    const baseLanguageCount = Math.floor(requiredJudgeCount / 2);
    const extraLanguage = Math.random() < 0.5 ? firstLanguage : secondLanguage; 

    return {
        [firstLanguage]: baseLanguageCount + (extraLanguage === firstLanguage ? 1 : 0), 
        [secondLanguage]: baseLanguageCount + (extraLanguage === secondLanguage ? 1 : 0)
    };

}

function getEligibleJudgesForLanguage(judgesByLanguage, judgeAssignmentTrackers, judgeLanguage, currentMatch){
    const matchTimeSlotIdentifier = createMatchTimeSlotIdentifier(currentMatch); 

    return judgesByLanguage[judgeLanguage].filter(currentJudge => {
        const currentTracker = judgeAssignmentTrackers[currentJudge.judgeID];
        return !currentTracker.assignedTimeSlots.includes(matchTimeSlotIdentifier); 
    });
}

function sortJudgesByAssignmentCount(eligibleJudges, judgeAssignmentTrackers){
    return [...eligibleJudges].sort((firstJudge, secondJudge) => {
        const firstJudgeTracker = judgeAssignmentTrackers[firstJudge.judgeID]; 
        const secondJudgeTracker = judgeAssignmentTrackers[secondJudge.judgeID]; 
        return firstJudgeTracker.assignmentCount - secondJudgeTracker.assignmentCount; 
    });
}

function shuffleArray(originalArray){
    const shuffledArray = [...originalArray]; 

    for (let currentIndex = shuffledArray.length - 1; currentIndex > 0; currentIndex--){
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        const temporaryValue = shuffledArray[currentIndex];

        shuffledArray[currentIndex] = shuffledArray[randomIndex]; 
        shuffledArray[randomIndex] = temporaryValue; 
    }

    return shuffledArray;
}

function selectJudgesForLanguage(judgesByLanguage, judgeAssignmentTrackers, judgeLanguage, requiredJudgeCount, currentMatch){

    const eligibleJudges = getEligibleJudgesForLanguage(judgesByLanguage, judgeAssignmentTrackers, judgeLanguage, currentMatch);
    const shuffledEligibleJudges = shuffleArray(eligibleJudges); 
    const sortedJudges = sortJudgesByAssignmentCount(shuffledEligibleJudges, judgeAssignmentTrackers); 
    
    if(sortedJudges.length < requiredJudgeCount){
        throw new Error(`Not enough eligible ${judgeLanguage} judges for match ${currentMatch.matchID}.`);
    }

    return sortedJudges.slice(0, requiredJudgeCount);  

}

function assignJudgesToMatch(currentMatch, selectedJudges, judgeAssignmentTrackers){

    const matchTimeSlotIdentifier = createMatchTimeSlotIdentifier(currentMatch); 

    currentMatch.assignedJudges = selectedJudges.map(currentJudge => {
        return {
            judgeID: currentJudge.judgeID, 
            judgeName: currentJudge.fullName
        }
    });

    for (const currentJudge of selectedJudges){
        const currentTracker = judgeAssignmentTrackers[currentJudge.judgeID]; 
        currentTracker.assignmentCount = currentTracker.assignmentCount + 1; 
        currentTracker.assignedTimeSlots.push(matchTimeSlotIdentifier); 
    }

}

function assignJudgesToAllMatches(preliminaryMatches, judgesByLanguage, judgeAssignmentTrackers){

    const scheduledMatches = shuffleArray(preliminaryMatches); 

    for (const currentMatch of scheduledMatches){
        const requiredJudgeCount = getRequiredJudgeCount(currentMatch); 
        const languageRequirements = getJudgeLanguageRequirements(currentMatch, requiredJudgeCount); 

        const selectedJudges = []; 

        for (const judgeLanguage in languageRequirements){
            const requiredLanguageCount = languageRequirements[judgeLanguage]; 
            const selectedLanguageJudges = selectJudgesForLanguage(judgesByLanguage, judgeAssignmentTrackers, judgeLanguage, requiredLanguageCount, currentMatch);
            selectedJudges.push(...selectedLanguageJudges);
        }

        assignJudgesToMatch(currentMatch, selectedJudges, judgeAssignmentTrackers); 
    }

    return scheduledMatches; 

}

function validateJudgeAssignments(assignedMatches, judgeAssignmentTrackers){

    const judgeTimeSlotMap = {}; 

    for (const currentMatch of assignedMatches){
        
        const requiredJudgeCount = getRequiredJudgeCount(currentMatch); 
        const assignedJudgeCount = currentMatch.assignedJudges?.length || 0; 

        if (assignedJudgeCount !== requiredJudgeCount){
            throw new Error(`Match ${currentMatch.matchID} expected ${requiredJudgeCount} judges, but found ${assignedJudgeCount}.`);
        }

        if (assignedJudgeCount % 2 === 0){
            throw new Error(`Match ${currentMatch.matchID} has an even number of judges.`); 
        }

        const matchTimeSlotIdentifier = createMatchTimeSlotIdentifier(currentMatch); 

        for (const currentJudge of currentMatch.assignedJudges){

            if (!currentJudge.judgeID || !currentJudge.judgeName){
                throw new Error(`Match ${currentMatch.matchID} has an assigned judge missing judgeID or judgeName.`);
            }

            const currentTracker = judgeAssignmentTrackers[currentJudge.judgeID];

            if (!currentTracker){
                throw new Error(`Judge ${currentJudge.judgeID} was assigned but does not exist in judge trackers.`);
            }

            if (!judgeTimeSlotMap[currentJudge.judgeID]){
                judgeTimeSlotMap[currentJudge.judgeID] = [];
            }

            if (judgeTimeSlotMap[currentJudge.judgeID].includes(matchTimeSlotIdentifier)){
                throw new Error(`Judge ${currentJudge.judgeID} is assigned twice at ${matchTimeSlotIdentifier}.`);
            }

            judgeTimeSlotMap[currentJudge.judgeID].push(matchTimeSlotIdentifier);

            if (currentMatch.needsTranslation !== true){
                if (currentTracker.judgeLanguage !== currentMatch.stateTeamLanguage){
                    throw new Error(`Judge ${currentJudge.judgeID} has language ${currentTracker.judgeLanguage}, but match ${currentMatch.matchID} requires ${currentMatch.stateTeamLanguage}.`);
                }
            }

        }

        if (currentMatch.needsTranslation === true){
            const requiredLanguages = currentMatch.matchLanguages; 
            const assignedLanguages = currentMatch.assignedJudges.map(currentJudge => {
                return judgeAssignmentTrackers[currentJudge.judgeID].judgeLanguage;
            });

            for (const requiredLanguage of requiredLanguages){
                if (!assignedLanguages.includes(requiredLanguage)){
                    throw new Error(`Translation match ${currentMatch.matchID} is missing a ${requiredLanguage} judge.`); 
                }
            }
        }
    }

    console.log('Judge assignment validation passed.'); 

}

function printJudgeAssignmentDistribution(judgeAssignmentTrackers){

    const finalDistribution = {}; 

    for (const currentTracker of Object.values(judgeAssignmentTrackers)){
        const assignmentCount = currentTracker.assignmentCount; 

        if (!finalDistribution[assignmentCount]){
            finalDistribution[assignmentCount] = 0; 
        }

        finalDistribution[assignmentCount] = finalDistribution[assignmentCount] + 1; 
    }

    console.log('Judge assignment distribution:');
    console.table(finalDistribution);  

}

async function main(){
    
    const mongoClient = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {
        
        await mongoClient.connect(); 

        const competitionDatabase = mongoClient.db('IAMOOT-2026'); 
        const matchesCollection = competitionDatabase.collection('preliminaryMatches');
        const judgesCollection = competitionDatabase.collection('preliminaryJudges'); 

        const preliminaryMatches = await matchesCollection.find().toArray(); 
        const preliminaryJudges = await judgesCollection.find().toArray(); 

        if (preliminaryMatches.length === 0){
            console.error('No preliminary matches found.'); 
            return; 
        }

        if (preliminaryJudges.length === 0){
            console.error('No preliminary judges found.'); 
            return; 
        }

        console.log(`Preliminary matches found: ${preliminaryMatches.length}`);
        console.log(`Preliminary judges found: ${preliminaryJudges.length}`); 
        console.log(); 

        const judgesByLanguage = groupJudgesByLanguage(preliminaryJudges); 

        console.log(`EN judges: ${judgesByLanguage.EN.length}`);
        console.log(`SPA judges: ${judgesByLanguage.SPA.length}`);
        console.log(`POR judges: ${judgesByLanguage.POR.length}`); 
        console.log(); 

        const judgeAssignmentTrackers = createJudgeAssignmentTrackers(preliminaryJudges); 
        
        console.log(`Judge assignment trackers created: ${Object.keys(judgeAssignmentTrackers).length}`);
        console.log();

        const assignedMatches = assignJudgesToAllMatches(preliminaryMatches, judgesByLanguage, judgeAssignmentTrackers); 

        console.log(`Assigned judges to ${assignedMatches.length} preliminary matches.`);
        console.table(assignedMatches.map(currentMatch => ({
            matchID: currentMatch.matchID, 
            date: currentMatch.matchDate, 
            time: currentMatch.matchTime, 
            room: currentMatch.roomNumber, 
            translation: currentMatch.needsTranslation, 
            judgeCount: currentMatch.assignedJudges.length
        })));

        validateJudgeAssignments(assignedMatches, judgeAssignmentTrackers); 
        printJudgeAssignmentDistribution(judgeAssignmentTrackers); 

        for (const currentMatch of assignedMatches){
            await matchesCollection.updateOne(
                { matchID: currentMatch.matchID },
                { 
                    $set: {
                        assignedJudges: currentMatch.assignedJudges
                    }
                }
            )
        }

        console.log(`${assignedMatches.length} preliminary matches updated with assigned judges.`); 

    } catch (error){
        console.error('Error assigning judges to preliminary matches: ', error); 
    } finally { 
        await mongoClient.close(); 
    }
}

main(); 