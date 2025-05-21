const { MongoClient } = require ('mongodb'); 
require('dotenv').config(); 

async function main(){
    const client = new MongoClient(process.env.MONGODB_URI_PROD);

    try {
        await client.connect(); 
        const db = client.db('ProdCluster'); 

        const matchesCollection = db.collection('preliminaryMatches'); 
        const teamsCollection = db.collection('teams'); 
        const speakersCollection = db.collection('speakers'); 

        console.log('Connected to MongoDB'); 

        const allMatches = await matchesCollection.find({}).toArray();

        let teamWinMap = new Map(); 
        let teamLossMap = new Map(); 

        for (const currentMatch of allMatches){
            const { firstTeam, secondTeam, matchWinner } = currentMatch; 

            if (!matchWinner || !firstTeam || !secondTeam) continue; 

            const matchWinnerNum = Number(matchWinner); 
            const losingTeam = matchWinnerNum === firstTeam ? secondTeam : firstTeam; 

            teamWinMap.set(matchWinnerNum, (teamWinMap.get(matchWinnerNum) || 0) + 1); 
            teamLossMap.set(losingTeam, (teamLossMap.get(losingTeam) || 0) + 1); 

        }

        const allTeams = await teamsCollection.find({}).toArray(); 
        let updatedTeams = 0; 

        for (const currentTeam of allTeams){

            const teamID = currentTeam.teamID; 
            const numberOfWins = teamWinMap.get(teamID) || 0; 
            const numberOfLosses = teamLossMap.get(teamID) || 0;

            //console.log(`Team ${teamID} -> Wins: ${numberOfWins}, Losses: ${numberOfLosses}`); 
            const updateResult = await teamsCollection.updateOne(
                { teamID },
                { $set: { preliminaryWins: numberOfWins, preliminaryLosses: numberOfLosses } }
            );

            if (updateResult.modifiedCount > 0) updatedTeams++; 
        }

        console.log(`Updated ${updatedTeams} teams with win/loss records.`); 

    } catch (err) { 
        console.error('Error: ', err);
    } finally { 
        await client.close(); 
    }

}

main(); 