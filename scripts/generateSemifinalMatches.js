const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

function shuffleArray(originalArray) {
    const shuffledArray = [...originalArray];

    for (let currentIndex = shuffledArray.length - 1; currentIndex > 0; currentIndex--) {
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        const temporaryValue = shuffledArray[currentIndex];
        shuffledArray[currentIndex] = shuffledArray[randomIndex];
        shuffledArray[randomIndex] = temporaryValue;
    }

    return shuffledArray;
}

async function generateSemifinalMatches(){

    const mongoClient = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {

        const competitionDatabase = mongoClient.db('IAMOOT-2026'); 
        const teamsCollection = competitionDatabase.collection('teams'); 
        const semifinalMatchesCollection = competitionDatabase.collection('semifinalMatches'); 

        const semifinalTeams = await teamsCollection.find({ advancedToSemifinals: true }).toArray(); 
        
        if (semifinalTeams.length % 2 !== 0){
            console.log(`Cannot generate semifinal matches because there are ${semifinalTeams.length} teams.`);
            return;
        }

        const shuffledTeams = shuffleArray(semifinalTeams); 
        const semifinalMatches = []; 

        for (let teamIndex = 0; teamIndex < shuffledTeams.length; teamIndex = teamIndex + 2){
            const firstTeam = shuffledTeams[teamIndex]; 
            const secondTeam = shuffledTeams[teamIndex + 1]; 

            const shouldSwapRoles = Math.random() < 0.5; 

            const stateTeam = shouldSwapRoles ? secondTeam : firstTeam;
            const victimTeam = shouldSwapRoles ? firstTeam : secondTeam; 

            semifinalMatches.push({
                matchID: `S${semifinalMatches.length + 1}`, 
                stateTeam: String(stateTeam.teamID), 
                victimTeam: String(victimTeam.teamID), 
                roomNumber: null, 
                matchDay: 'Thursday', 
                matchDate: null, 
                matchTime: null, 
                assignedJudges: [],
                gradedJudges: [] 
            });
        } 

        await semifinalMatchesCollection.deleteMany({}); 
        await semifinalMatchesCollection.insertMany(semifinalMatches); 

        console.log(`Generated ${semifinalMatches.length} semifinalMatches.`); 
        console.log('Semifinal match generation script completed'); 

    } catch (error){
        console.error('Error generating semifinal matches: ', error); 
    } finally {
        await mongoClient.close(); 
    }

}

generateSemifinalMatches(); 