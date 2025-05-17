const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

async function main() { 
    const client = new MongoClient(process.env.MONGODB_URI_PROD); 

    try {

        await client.connect(); 
        const db = client.db('ProdCluster'); 
        const matchesCollection = db.collection('preliminaryMatches'); 

        /* DATES, TIMES, AND ROOMS DECLARATIONS */
        const matchDates = ['2025-05-19', '2025-05-20', '2025-05-21'];
        const matchTimes = ['9:00 AM', '12:30 PM', '3:15 PM'];
        const roomNames = [
            'NT01*', 'NT07*', 'NT08*', 'NT02', 'NT03', 
            'N101', 'N102', 'N103', 'N104', 
            'Y400', 'Y402', 'Y403', 
            'YT15', 'YT16', 'YT17'
        ];

        /* GENERATE ALL POSSIBLE MATCH SLOTS */
        const availableMatchSlots = []; 

        for (const matchDate of matchDates){
            for (const matchTime of matchTimes){
                for (const roomName of roomNames){
                    availableMatchSlots.push({
                        matchDate: matchDate, 
                        matchTime: matchTime, 
                        roomNumber: roomName
                    })
                }
            }
        }

        console.log(`Total available slots: ${availableMatchSlots.length}`);

        /* SHUFFLE THE POSSIBLE MATCH SLOTS */
        for (let currentIndex = availableMatchSlots.length - 1; currentIndex > 0; currentIndex--){
            const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
            const tempMatchSlot = availableMatchSlots[currentIndex];
            availableMatchSlots[currentIndex] = availableMatchSlots[randomIndex]; 
            availableMatchSlots[randomIndex] = tempMatchSlot;
        }

        /* FETCH ALL THE MATCHES */
        const allMatches = await matchesCollection.find().toArray(); 
        console.log(`Total matches found: ${allMatches.length}`);

        /* MAP THAT TRACKS THE DATES THAT A TEAM IS SCHEDULED TO COMPETE ON */
        const teamScheduleMap = {};

        /* TRACK LANGUAGES ASSIGNED PER DAY */
        const dailyLanguageCount = {
            '2025-05-19': { English: 0, Spanish: 0, Portuguese: 0 },
            '2025-05-20': { English: 0, Spanish: 0, Portuguese: 0 }, 
            '2025-05-21': { English: 0, Spanish: 0, Portuguese: 0 }
        }

        /* ESTABLISH LANGUAGE LIMITS PER DAY */
        const maxLanguagePerDay = {
            English: 4,
            Spanish: 14, 
            Portuguese: 5
        }

        /* TRACK USED SLOTS */
        const usedSlots = new Set(); 

        function getMatchLanguage(matchID) {
            if (matchID >= 1 && matchID <= 6) return 'English';
            if (matchID >= 7 && matchID <= 39) return 'Spanish'; 
            if (matchID >= 40 && matchID <= 49) return 'Portuguese'; 
            return 'Unknown'; 
        }

        /* MATCH ASSIGNMENT */
        for (const currentMatch of allMatches){
            
            const firstTeam = currentMatch.firstTeam; 
            const secondTeam = currentMatch.secondTeam; 
            const matchLanguage = getMatchLanguage(currentMatch.matchID); 

            let isAssigned = false; 

            for (const currentMatchSlot of availableMatchSlots){
                const slotKey = `${currentMatchSlot.matchDate}|${currentMatchSlot.matchTime}|${currentMatchSlot.roomNumber}`;

                /* If the currentMatchSlot has already been used, then move to the next currentMatchSlot*/
                if (usedSlots.has(slotKey)){ 
                    continue;
                } 

                /* If firstTeam or secondTeam has had a match on currentMatchSlot.matchDate, then move to the next currentMatchSlot */
                const firstTeamDates = teamScheduleMap[firstTeam] || [];
                const secondTeamDates = teamScheduleMap[secondTeam] || [];
                if (firstTeamDates.includes(currentMatchSlot.matchDate) || secondTeamDates.includes(currentMatchSlot.matchDate)){
                    continue; 
                }

                /* If the matchLanguage for currentMatchSlot.matchDate has surpassed maxLanguagePerDay, then move to the currentMatchSlot */
                if (dailyLanguageCount[currentMatchSlot.matchDate][matchLanguage] >= maxLanguagePerDay[matchLanguage]){
                    continue;
                }

                /* Assign this slot if it reaches this portion as it passed all previous checks! */
                currentMatch.matchDate = currentMatchSlot.matchDate; 
                currentMatch.matchTime = currentMatchSlot.matchTime; 
                currentMatch.roomNumber = currentMatchSlot.roomNumber; 

                /* Update the trackers! */
                teamScheduleMap[firstTeam] = [...firstTeamDates, currentMatchSlot.matchDate];
                teamScheduleMap[secondTeam] = [...secondTeamDates, currentMatchSlot.matchDate]; 
                dailyLanguageCount[currentMatchSlot.matchDate][matchLanguage]++;
                usedSlots.add(slotKey); 

                await matchesCollection.updateOne(
                    { matchID: currentMatch.matchID }, 
                    {
                        $set: {
                            matchDate: currentMatch.matchDate, 
                            matchTime: currentMatch.matchTime,
                            roomNumber: currentMatch.roomNumber
                        }
                    }
                )

                isAssigned = true; 
                break;
            }

            if (!isAssigned){
                console.warn(`Could not assign a valid slot for matchID: ${currentMatch.matchID}`);
            }
        }

        console.log(`Schedule assignment complete. ${allMatches.length} matches processed and updated.`);

    } catch (err) {
        console.error('Error: ', err); 
    } finally { 
        await client.close(); 
    }
}

main(); 