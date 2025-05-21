const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

async function main(){
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {

        await client.connect(); 
        const db = client.db('ProdCluster'); 

        const teamsCollection = db.collection('teams'); 
        const semiTeamsCollection = db.collection('semiTeams'); 
        const matchesCollection = db.collection('preliminaryMatches'); 

        console.log('Connected to MongoDB'); 

        const advancingTeamIDs = [273, 132, 138, 170, 102, 173, 201, 203, 231, 232, 233, 235, 241, 243, 244, 245, 249, 270, 133, 103, 140, 142, 143, 174, 274, 271];
        
        await semiTeamsCollection.deleteMany({});

        const selectedTeams = await teamsCollection.find({
            teamID: { $in: advancingTeamIDs }
        }).toArray(); 

        if (selectedTeams.length !== advancingTeamIDs.length){
            console.warn('Warning: Some teamIDs were not found in the database.')
        }

        await semiTeamsCollection.insertMany(selectedTeams); 
        console.log(`Inserted ${selectedTeams.length} teams into the 'semiTeams' collection.`)

        /**************************
         * SHUFFLE SELECTED TEAMS *
         **************************/
        function shuffleTeams(teamList){
            for (let currentIndex = teamList.length - 1; currentIndex > 0; currentIndex--){
                const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
                const teamBeingMoved = teamList[currentIndex]; 
                teamList[currentIndex] = teamList[randomIndex]; 
                teamList[randomIndex] = teamBeingMoved; 
            }
        }

        shuffleTeams(selectedTeams);
        console.log('Shuffled teams for random matchups.'); 

        /*******************************
         * PAIR TEAMS AND ASSIGN ROLES *
         *******************************/

        const semiFinalMatches = []; 
        let startingMatchID = 100; 

        for (let teamPairIndex = 0; teamPairIndex < selectedTeams.length; teamPairIndex = teamPairIndex + 2){
            const teamA = selectedTeams[teamPairIndex]; 
            const teamB = selectedTeams[teamPairIndex + 1];

            if (!teamA || !teamB){
                console.warn('Uneven number of teams. Skipping last unpaired team.');
                break;
            }

            const assignFirstAsVictim = Math.random() < 0.5; 

            const firstTeam = assignFirstAsVictim ? teamA.teamID : teamB.teamID;
            const firstTeamRole = 'Victim'; 

            const secondTeam = assignFirstAsVictim ? teamB.teamID : teamA.teamID; 
            const secondTeamRole = 'State'; 

            const matchObject = {
                matchID: startingMatchID++,
                firstTeam, 
                firstTeamRole, 
                secondTeam, 
                secondTeamRole
            };

            semiFinalMatches.push(matchObject); 
        }

        /*****************************************
         * INSERT SEMIFINAL MATCHES INTO MONGODB *
         *****************************************/
        if (semiFinalMatches.length === 0){
            console.warn('No matches generated. Nothing to insert.');
        } else { 
            const insertResult = await matchesCollection.insertMany(semiFinalMatches); 
            console.log(`Inserted ${insertResult.insertedCount} semifinal matches into the preliminaryMatches`);
        }

        /***********
         * SUMMARY *
         ***********/
        console.log('\nSemifinal Matchups:');
        semiFinalMatches.forEach((currentMatch) => {
            console.log(`Match ${currentMatch.matchID}: Team ${currentMatch.firstTeam} (${currentMatch.firstTeamRole}) vs ${currentMatch.secondTeam} (${currentMatch.secondTeamRole})`);
        })

    } catch (err){
        console.error('Error: ', err); 
    } finally{
        await client.close(); 
    }
}

main(); 