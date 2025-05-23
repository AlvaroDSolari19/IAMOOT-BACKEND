const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

async function calculateSpeakerAverages(){
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try{
        await client.connect(); 
        const db = client.db('ProdCluster');

        const speakersCollection = db.collection('speakers'); 
        const allSpeakers = await speakersCollection.find({}).toArray();
        let speakerUpdateCount = 0; 
        
        for (const currentSpeaker of allSpeakers){
            const scoreArray = currentSpeaker.receivedScores; 

            if (!Array.isArray(scoreArray) || scoreArray.length === 0){
                console.log(`Skipping ${currentSpeaker.speakerID}: No scores`);
                continue; 
            }

            const numericScores = scoreArray.map(currentScore => Number(currentScore)).filter(currentScore => !isNaN(currentScore));
            let speakerAverageScore; 

            if (numericScores.length >= 5){
                const orderedScores = [...numericScores].sort((scoreA, scoreB) => scoreA - scoreB);
                const trimmedScores = orderedScores.slice(1, orderedScores.length - 1); 
                const totalTrimmedScore = trimmedScores.reduce((runningSum, currentScore) => runningSum + currentScore, 0);
                speakerAverageScore = Number((totalTrimmedScore / trimmedScores.length).toFixed(2));
            } else { 
                console.warn(`Skipping speaker ${currentSpeaker.speakerID}: Fewer than 5 scores`);
                continue; 
            }

            await speakersCollection.updateOne(
                { speakerID: currentSpeaker.speakerID }, 
                { $set: { speakerSemiScoreAverage: speakerAverageScore } }
            );

            speakerUpdateCount++; 
        }

        console.log(`Updated ${speakerUpdateCount} speakers with speakerSemiScoreAverage.`); 

    } catch (error) {
        console.error('Error calculating speaker averages: ', error); 
    } finally {
        await client.close(); 
    }

}

async function calculateTeamAverages(){
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {
        await client.connect(); 
        const db = client.db('ProdCluster'); 
        const speakersCollection = db.collection('speakers'); 
        const semiTeamsCollection = db.collection('semiTeams'); 

        const allSpeakers = await speakersCollection.find({
            speakerSemiScoreAverage:  {$exists: true }
        }).toArray(); 

        const teamToSpeakerScoresMap = new Map(); 

        for (const currentSpeaker of allSpeakers){
            const teamID = currentSpeaker.teamID; 
            const speakerAverage = currentSpeaker.speakerSemiScoreAverage; 

            if (!teamToSpeakerScoresMap.has(teamID)){
                teamToSpeakerScoresMap.set(teamID, []); 
            }

            teamToSpeakerScoresMap.get(teamID).push(speakerAverage); 
        }

        let teamUpdateCount = 0; 

        for (const [teamID, speakerAverages] of teamToSpeakerScoresMap.entries()){
            if (speakerAverages.length !== 2){
                console.warn(`Skipping team ${teamID}: Expected 2 speakers, found ${speakerAverages.length}`);
                continue; 
            }

            const totalTeamScore = speakerAverages[0] + speakerAverages[1]; 
            const teamAverageScore = Number((totalTeamScore / 2).toFixed(2)); 

            await semiTeamsCollection.updateOne(
                { teamID: teamID },
                { $set: { averageSemiScore: teamAverageScore } }
            );

            teamUpdateCount++; 
        }

        console.log(`Updated ${teamUpdateCount} teams with averageSemiScore.`);

    } catch (error) {
        console.error('Error calculating team averages'); 
    } finally { 
        await client.close(); 
    }
}

async function runBothPhases(){
    await calculateSpeakerAverages(); 
    await calculateTeamAverages(); 
}

runBothPhases(); 