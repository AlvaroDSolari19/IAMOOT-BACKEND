const { MongoClient } = require ('mongodb'); 
require('dotenv').config(); 

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {
        await client.connect(); 
        const db = client.db('ProdCluster'); 
        const speakersCollection = db.collection('speakers'); 

        const allSpeakers = await speakersCollection.find({}).toArray(); 
        let updatedCount = 0; 

        for (const currentSpeaker of allSpeakers){

            const matchAverageScores = currentSpeaker.averageScores; 

            if(!Array.isArray(matchAverageScores) || matchAverageScores.length === 0){
                continue; 
            }

            /****************************
             * SORT ON DESCENDING ORDER *
             ****************************/
            const sortedMatchScores = matchAverageScores.slice().sort((scoreOne, scoreTwo) => scoreTwo - scoreOne);

            let finalPrelimScore; 
            if (sortedMatchScores.length >= 2){
                finalPrelimScore = (sortedMatchScores[0] + sortedMatchScores[1]) / 2;
            } else { 
                finalPrelimScore = sortedMatchScores[0]; 
            }

            finalPrelimScore = Math.round(finalPrelimScore * 100) / 100; 

            const updateResult = await speakersCollection.updateOne(
                { speakerID: currentSpeaker.speakerID }, 
                { $set: { preliminaryAverageScore: finalPrelimScore } }
            );

            if (updateResult.modifiedCount > 0){
                updatedCount++; 
            }

        }

        console.log(`Updated ${updatedCount} speakers with preliminaryAverageScore`);

    } catch (err) {
        console.error('Error running script: ', err); 
    } finally {
        await client.close(); 
    }
}

main(); 