const { MongoClient } = require('mongodb');
require('dotenv').config();

async function generatePreliminaryAdvancement(){

    const mongoClient = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {
        await mongoClient.connect(); 

        const competitionDatabase = mongoClient.db('IAMOOT-2026');
        const teamsCollection = competitionDatabase.collection('teams'); 
        const preliminaryMatchesCollection = competitionDatabase.collection('preliminaryMatches'); 

        const preliminaryMatches = await preliminaryMatchesCollection.find({}).toArray(); 
        const teamRecords = {}; 

        preliminaryMatches.forEach((matchRecord) => {
            if (!matchRecord.winningTeam){
                console.log(`Skipping match ${matchRecord.matchID} because no winner has been selected.`);
                return; 
            }

            const stateTeamID = String(matchRecord.stateTeam); 
            const victimTeamID = String(matchRecord.victimTeam); 
            const winningTeamID = String(matchRecord.winningTeam); 

            if (!teamRecords[stateTeamID]) {
                teamRecords[stateTeamID] = { numberOfWins: 0, numberOfLosses: 0 }; 
            }

            if (!teamRecords[victimTeamID]) {
                teamRecords[victimTeamID] = { numberOfWins: 0, numberOfLosses: 0 }; 
            }

            if (winningTeamID === stateTeamID){
                teamRecords[stateTeamID].numberOfWins = teamRecords[stateTeamID].numberOfWins + 1; 
                teamRecords[victimTeamID].numberOfLosses = teamRecords[victimTeamID].numberOfLosses + 1; 
            }

            if (winningTeamID === victimTeamID){
                teamRecords[victimTeamID].numberOfWins = teamRecords[victimTeamID].numberOfWins + 1; 
                teamRecords[stateTeamID].numberOfLosses = teamRecords[stateTeamID].numberOfLosses + 1; 
            }
        });

        let numberOfAdvancedTeams = 0; 

        for ( const [teamID, teamRecord] of Object.entries(teamRecords)){
            const advancedToSemifinals = teamRecord.numberOfWins === 2; 

            await teamsCollection.updateOne(
                { teamID }, 
                {
                    $set: {
                        advancedToSemifinals
                    }
                }
            );

            if (advancedToSemifinals){
                numberOfAdvancedTeams = numberOfAdvancedTeams + 1; 
            }

        }

        console.log(`Total teams automatically advanced to semifinals: ${numberOfAdvancedTeams}`); 
        console.log('Preliminary advancement script completed.'); 

    } catch (error){
        console.error('Error generating preliminary advancement: ', error); 
    } finally {
        await mongoClient.close(); 
    }

}

generatePreliminaryAdvancement(); 