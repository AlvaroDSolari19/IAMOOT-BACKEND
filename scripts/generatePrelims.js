const { MongoClient } = require('mongodb');
require('dotenv').config();

async function main() {
    const client = new MongoClient(process.env.MONGODB_URI_PROD);

    try {
        await client.connect();
        const db = client.db('ProdCluster');
        const teamsCollection = db.collection('teams');
        const matchesCollection = db.collection('preliminaryMatches');

        /* Retrieve all teams from MongoDB */
        const allTeams = await teamsCollection.find().toArray();
        if (allTeams.length === 0) {
            console.error('No teams found in the database.');
            return;
        }

        /* Group teams by language */
        const teamsByLanguage = {};
        for (const currentTeam of allTeams) {
            const currentLanguage = currentTeam.teamLanguage || 'Unknown';
            if (!teamsByLanguage[currentLanguage]) {
                teamsByLanguage[currentLanguage] = [];
            }
            teamsByLanguage[currentLanguage].push(currentTeam);
        }

        for (const currentLanguage in teamsByLanguage) {
            console.log(`${currentLanguage}: ${teamsByLanguage[currentLanguage].length} team(s)`);
        }

        const preliminaryMatches = [];
        let matchIDCounter = 1;

        for (const currentLanguage in teamsByLanguage) {
            const teamsInThisLanguage = teamsByLanguage[currentLanguage];

            const unpairedTeamsQueue = teamsInThisLanguage.map(currentTeam => ({
                ...currentTeam,
                hasBeenState: false,
                hasBeenVictim: false,
                numberOfMatches: 0
            }));

            /* Shuffle the unpairedTeamsQueue by using the Fisher-Yates shuffle as they were in teamID order */
            for (let currentIndex = unpairedTeamsQueue.length - 1; currentIndex > 0; currentIndex--) {
                const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
                const tempTeam = unpairedTeamsQueue[currentIndex];
                unpairedTeamsQueue[currentIndex] = unpairedTeamsQueue[randomIndex];
                unpairedTeamsQueue[randomIndex] = tempTeam;
            }

            /* Pairing for unpairedTeamsQueue */
            while (unpairedTeamsQueue.length >= 2) {

                const currentTeam = unpairedTeamsQueue.pop();

                /* Find a match for currentTeam  */
                const opponentIndex = unpairedTeamsQueue.findIndex(opponentTeam => opponentTeam.numberOfMatches < 2);
                const opponentTeam = unpairedTeamsQueue.splice(opponentIndex, 1)[0];

                /* Assign Roles*/
                let firstTeam  = currentTeam ;
                let secondTeam = opponentTeam;
                let firstTeamRole, secondTeamRole;

                if (!firstTeam.hasBeenState && !secondTeam.hasBeenVictim) {
                    firstTeamRole = 'State';
                    secondTeamRole = 'Victim';
                } else if (!firstTeam.hasBeenVictim && !secondTeam.hasBeenState) {
                    firstTeamRole = 'Victim';
                    secondTeamRole = 'State';
                } else if (!firstTeam.hasBeenState) {
                    firstTeamRole = 'State';
                    secondTeamRole = 'Victim';
                } else if (!firstTeam.hasBeenVictim) {
                    firstTeamRole = 'Victim';
                    secondTeamRole = 'State';
                } else {
                    firstTeamRole = 'State';
                    secondTeamRole = 'Victim';
                }

                /* Update Match Counters */
                firstTeam.numberOfMatches = firstTeam.numberOfMatches + 1;
                secondTeam.numberOfMatches = secondTeam.numberOfMatches + 1;
                if (firstTeamRole === 'State') firstTeam.hasBeenState = true;
                if (firstTeamRole === 'Victim') firstTeam.hasBeenVictim = true;
                if (secondTeamRole === 'State') secondTeam.hasBeenState = true;
                if (secondTeamRole === 'Victim') secondTeam.hasBeenVictim = true;

                /* Save the match */
                preliminaryMatches.push({
                    matchID: `${matchIDCounter++}`,
                    firstTeam: firstTeam.teamID,
                    firstTeamRole: firstTeamRole,
                    secondTeam: secondTeam.teamID,
                    secondTeamRole: secondTeamRole,
                    needsTranslation: false,
                    roomNumber: null,
                    matchDate: null,
                    matchTime: null,
                })

                /* Reinsert if needs a second match */
                if (firstTeam.numberOfMatches < 2) unpairedTeamsQueue.unshift(firstTeam);
                if (secondTeam.numberOfMatches < 2) unpairedTeamsQueue.unshift(secondTeam);

            }

        }

        await matchesCollection.insertMany(preliminaryMatches);
        console.log(`${preliminaryMatches.length} matches saved to preliminaryMatches collection.`);

    } catch (err) {
        console.error('Error connecting to MongoDB or reading data: ', err);
    } finally {
        await client.close();
    }
}

main(); 