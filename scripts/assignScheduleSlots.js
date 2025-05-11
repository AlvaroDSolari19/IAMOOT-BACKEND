const { MongoClient } = require('mongodb'); 
require('dotenv').config(); 

async function main() { 
    const client = new MongoClient(process.env.MONGODB_URI); 

    try {

        await client.connect(); 
        const db = client.db('IAMOOT-DB'); 
        const matchesCollection = db.collection('preliminaryMatches'); 

        /* DATES, TIMES, AND ROOMS DECLARATIONS */
        const matchDates = ['2025-05-19', '2025-05-20', '2025-05-21'];
        const matchTimes = ['8:30 AM', '12:30 PM', '3:15 PM'];
        const roomNames = [
            'NT01*', 'NT07*', 'NT08*', 'NT02', 'NT03', 
            'N101', 'N102', 'N103', 'N104', 'N105', 
            'Y400', 'Y402', 'Y403', 'Y404', 'YT17', 
            'CT16', 'CT17', 'C117'
        ];

        /* GENERATE ALL POSSIBLE MATCH SLOTS */
        const availableMatchSlots = []; 

        for (const matchDate of matchDates){
            for (const matchTime of matchTimes){
                for (const roomName of roomNames){
                    availableMatchSlots.push({
                        matchDate, 
                        matchTime, 
                        roomNumber: roomName
                    })
                }
            }
        }

        console.log(`Total available slots: ${availableMatchSlots.length}`);

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
            English: 2,
            Spanish: 11, 
            Portuguese: 4
        }

        /* TRACK USED SLOTS */
        const usedSlots = new Set(); 

    } catch (err) {
        console.error('Error: ', err); 
    } finally { 
        await client.close(); 
    }
}

main(); 