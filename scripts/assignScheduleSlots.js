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

    } catch (err) {
        console.error('Error: ', err); 
    } finally { 
        await client.close(); 
    }
}

main(); 