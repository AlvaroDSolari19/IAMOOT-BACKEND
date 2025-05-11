const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

async function main(){
    const client = new MongoClient(process.env.MONGODB_URI); 

    try{
        await client.connect(); 
        const db = client.db('IAMOOT-DB'); 
        const teamsCollection = db.collection('teams'); 

        /* Retrieve all teams from MongoDB */
        const allTeams = await teamsCollection.find().toArray(); 
        if (allTeams.length === 0){
            console.error('No teams found in the database.');
            return; 
        }

        /* Group teams by language */
        const teamsByLanguage = {}; 
        for (const currentTeam of allTeams){
            const currentLanguage = currentTeam.teamLanguage || 'Unknown'; 
            if (!teamsByLanguage[currentLanguage]){
                teamsByLanguage[currentLanguage] = []; 
            }
            teamsByLanguage[currentLanguage].push(currentTeam); 
        }

        for (const currentLanguage in teamsByLanguage){
            console.log(`${currentLanguage}: ${teamsByLanguage[currentLanguage].length} team(s)`);
        }

    } catch (err) {
        console.error('Error connecting to MongoDB or reading data: ', err); 
    } finally {
        await client.close(); 
    }
}

main(); 