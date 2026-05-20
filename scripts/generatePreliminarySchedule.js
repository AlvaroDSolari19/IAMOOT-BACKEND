const { MongoClient } = require('mongodb');
require('dotenv').config();

const matchDates = [
    { dayLabel: 'Monday', calendarDate: '05-18-2026' },
    { dayLabel: 'Tuesday', calendarDate: '05-19-2026' },
    { dayLabel: 'Wednesday', calendarDate: '05-20-2026' }
];

const matchTimes = [
    '9:00 AM',
    '12:30 PM',
    '3:15 PM'
];

const competitionRooms = [
    { roomNumber: 'NT01', supportsTranslation: true, maxJudges: 9 },
    { roomNumber: 'NT07', supportsTranslation: true, maxJudges: 9 },
    { roomNumber: 'NT08', supportsTranslation: true, maxJudges: 9 },

    { roomNumber: 'YT17', supportsTranslation: false, maxJudges: 9 },
    { roomNumber: 'Y400', supportsTranslation: false, maxJudges: 9 },
    { roomNumber: 'Y401', supportsTranslation: false, maxJudges: 9 },

    { roomNumber: 'CT16', supportsTranslation: false, maxJudges: 5 },
    { roomNumber: 'CT17', supportsTranslation: false, maxJudges: 5 },
    { roomNumber: 'C117', supportsTranslation: false, maxJudges: 5 },
]

function generateTranslationEligibleSlots() {
    const translationDates = matchDates.filter(currentDate => {
        return currentDate.dayLabel === 'Tuesday' || currentDate.dayLabel === 'Wednesday';
    });

    const translationRooms = competitionRooms.filter(currentRoom => {
        return currentRoom.supportsTranslation === true;
    });

    const translationEligibleSlots = [];

    for (const currentDate of translationDates) {
        for (const currentTime of matchTimes) {
            for (const currentRoom of translationRooms) {
                translationEligibleSlots.push({
                    matchDate: currentDate.calendarDate,
                    matchDay: currentDate.dayLabel,
                    matchTime: currentTime,
                    roomNumber: currentRoom.roomNumber
                });
            }
        }
    }

    return translationEligibleSlots;
}

function generateAllAvailableSlots() {
    const allAvailableSlots = [];

    for (const currentDate of matchDates) {
        for (const currentTime of matchTimes) {
            for (const currentRoom of competitionRooms) {
                allAvailableSlots.push({
                    matchDate: currentDate.calendarDate,
                    matchDay: currentDate.dayLabel,
                    matchTime: currentTime,
                    roomNumber: currentRoom.roomNumber
                })
            }
        }
    }

    return allAvailableSlots;
}

function createSlotIdentifier(scheduleSlot) {
    return `${scheduleSlot.matchDate}|${scheduleSlot.matchTime}|${scheduleSlot.roomNumber}`;
}

function createTimeSlotIdentifier(scheduleSlot) {
    return `${scheduleSlot.matchDate}|${scheduleSlot.matchTime}`;
}

function createTranslationTypeIdentifier(currentMatch) {
    return [...currentMatch.matchLanguages].sort().join('-');
}

function canTeamsPlayOnDate(teamScheduleMap, currentMatch, matchDate) {
    const stateTeamDates = teamScheduleMap[currentMatch.stateTeam] || [];
    const victimTeamDates = teamScheduleMap[currentMatch.victimTeam] || [];

    return !stateTeamDates.includes(matchDate) && !victimTeamDates.includes(matchDate);
}

function createScheduleTrackers() {
    return {
        usedSlotIdentifiers: new Set(),
        teamScheduleMap: {},
        translationTypeTimeMap: {},
        dailyMatchCount: {
            '05-18-2026': 0,
            '05-19-2026': 0,
            '05-20-2026': 0
        }
    }
}

function assignMatchToSlot(currentMatch, scheduleSlot, scheduleTrackers) {
    currentMatch.matchDate = scheduleSlot.matchDate;
    currentMatch.matchDay = scheduleSlot.matchDay;
    currentMatch.matchTime = scheduleSlot.matchTime;
    currentMatch.roomNumber = scheduleSlot.roomNumber;

    const slotIdentifier = createSlotIdentifier(scheduleSlot);
    scheduleTrackers.usedSlotIdentifiers.add(slotIdentifier);

    const stateTeamDates = scheduleTrackers.teamScheduleMap[currentMatch.stateTeam] || [];
    const victimTeamDates = scheduleTrackers.teamScheduleMap[currentMatch.victimTeam] || [];

    scheduleTrackers.teamScheduleMap[currentMatch.stateTeam] = [
        ...stateTeamDates,
        scheduleSlot.matchDate
    ];

    scheduleTrackers.teamScheduleMap[currentMatch.victimTeam] = [
        ...victimTeamDates,
        scheduleSlot.matchDate
    ];

    scheduleTrackers.dailyMatchCount[scheduleSlot.matchDate] = scheduleTrackers.dailyMatchCount[scheduleSlot.matchDate] + 1;

    if (currentMatch.needsTranslation) {
        const timeSlotIdentifier = createTimeSlotIdentifier(scheduleSlot);
        const translationTypeIdentifier = createTranslationTypeIdentifier(currentMatch);

        if (!scheduleTrackers.translationTypeTimeMap[timeSlotIdentifier]) {
            scheduleTrackers.translationTypeTimeMap[timeSlotIdentifier] = [];
        }

        scheduleTrackers.translationTypeTimeMap[timeSlotIdentifier].push(translationTypeIdentifier);
    }
}

function shuffleArray(originalArray){
    const shuffledArray = [...originalArray];

    for (let currentIndex = shuffledArray.length - 1; currentIndex > 0; currentIndex--){
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        const temporaryValue = shuffledArray[currentIndex];

        shuffledArray[currentIndex] = shuffledArray[randomIndex];
        shuffledArray[randomIndex] = temporaryValue; 
    }

    return shuffledArray; 
}

function canAssignTranslationMatch(currentMatch, scheduleSlot, scheduleTrackers, dailyMatchLimits) {
    const slotIdentifier = createSlotIdentifier(scheduleSlot);

    if (scheduleTrackers.usedSlotIdentifiers.has(slotIdentifier)) {
        return false;
    }

    if (!canTeamsPlayOnDate(scheduleTrackers.teamScheduleMap, currentMatch, scheduleSlot.matchDate)) {
        return false;
    }

    if (scheduleTrackers.dailyMatchCount[scheduleSlot.matchDate] >= dailyMatchLimits[scheduleSlot.matchDate]) {
        return false;
    }

    const translationTypeIdentifier = createTranslationTypeIdentifier(currentMatch);
    const timeSlotIdentifier = createTimeSlotIdentifier(scheduleSlot);
    const scheduledTranslationTypes = scheduleTrackers.translationTypeTimeMap[timeSlotIdentifier] || [];

    if (scheduledTranslationTypes.includes(translationTypeIdentifier)) {
        return false;
    }

    return true;

}

function scheduleTranslationMatches(translationMatches, translationEligibleSlots, scheduleTrackers, dailyMatchLimits) {
    const shuffledTranslationMatches = shuffleArray(translationMatches);

    for (const currentMatch of shuffledTranslationMatches) {
        const shuffledTranslationEligibleSlots = shuffleArray(translationEligibleSlots);
        const validSlot = shuffledTranslationEligibleSlots.find(scheduleSlot => {
            return canAssignTranslationMatch(currentMatch, scheduleSlot, scheduleTrackers, dailyMatchLimits);
        });

        if (!validSlot) {
            throw new Error(`Unable to schedule translation match ${currentMatch.matchID}`);
        }

        assignMatchToSlot(currentMatch, validSlot, scheduleTrackers);
    }
}

function canAssignRegularMatch(currentMatch, scheduleSlot, scheduleTrackers, dailyMatchLimits) {
    const slotIdentifier = createSlotIdentifier(scheduleSlot);

    if (scheduleTrackers.usedSlotIdentifiers.has(slotIdentifier)) {
        return false;
    }

    if (!canTeamsPlayOnDate(scheduleTrackers.teamScheduleMap, currentMatch, scheduleSlot.matchDate)) {
        return false;
    }

    if (scheduleTrackers.dailyMatchCount[scheduleSlot.matchDate] >= dailyMatchLimits[scheduleSlot.matchDate]) {
        return false;
    }

    return true;
}

function scheduleRegularMatches(regularMatches, allAvailableSlots, scheduleTrackers, dailyMatchLimits) {
    const shuffledRegularMatches = shuffleArray(regularMatches);

    for (const currentMatch of shuffledRegularMatches) {
        const shuffledAvailableSlots = shuffleArray(allAvailableSlots); 
        const validSlot = shuffledAvailableSlots.find(scheduleSlot => {
            return canAssignRegularMatch(currentMatch, scheduleSlot, scheduleTrackers, dailyMatchLimits);
        })

        if (!validSlot) {
            throw new Error(`Unable to schedule regular match ${currentMatch.matchID}`);
        }

        assignMatchToSlot(currentMatch, validSlot, scheduleTrackers);
    }
}

function generateOneScheduleAttempt(translationMatches, regularMatches, translationEligibleSlots, allAvailableSlots, dailyMatchLimits){
    const scheduleTrackers = createScheduleTrackers(); 

    const scheduledTranslationMatches = translationMatches.map(currentMatch => {
        return {...currentMatch};
    }); 

    const scheduledRegularMatches = regularMatches.map(currentMatch => {
        return {...currentMatch};
    });

    scheduleTranslationMatches(scheduledTranslationMatches, translationEligibleSlots, scheduleTrackers, dailyMatchLimits);
    scheduleRegularMatches(scheduledRegularMatches, allAvailableSlots, scheduleTrackers, dailyMatchLimits); 

    return {
        scheduledMatches: [
            ...scheduledTranslationMatches, 
            ...scheduledRegularMatches
        ], 
        scheduleTrackers
    };
}

function findValidScheduleAttempt(translationMatches, regularMatches, translationEligibleSlots, allAvailableSlots, dailyMatchLimits, maxAttempts){
    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++){
        try {
            const currentAttempt = generateOneScheduleAttempt(translationMatches, regularMatches, translationEligibleSlots, allAvailableSlots, dailyMatchLimits);
            console.log(`Valid schedule found on attempt ${attemptNumber}.`);
            return currentAttempt; 
        } catch (error){
            continue; 
        }
    }
    throw new Error(`Unable to generate a valid preliminary schedule after ${maxAttempts} attempts.`);
}

function validateScheduledMatches(scheduledMatches, dailyMatchLimits){
    if (scheduledMatches.length !== 43){
        throw new Error(`Expected 43 scheduled matches, but found ${scheduledMatches.length}.`);
    }

    const usedSlotIdentifiers = new Set(); 
    const teamDateMap = {}; 
    const dailyMatchCount = {
        '05-18-2026': 0, 
        '05-19-2026': 0, 
        '05-20-2026': 0
    };
    const translationTypeTimeMap = {}; 

    for (const currentMatch of scheduledMatches){
        if(!currentMatch.matchDate || !currentMatch.matchDay || !currentMatch.matchTime || !currentMatch.roomNumber){
            throw new Error(`Match ${currentMatch.matchID} is missing schedule data.`);
        }

        const slotIdentifier = createSlotIdentifier(currentMatch); 

        if (usedSlotIdentifiers.has(slotIdentifier)){
            throw new Error(`Duplicate room/time slot found: ${slotIdentifier}.`);
        }

        usedSlotIdentifiers.add(slotIdentifier);

        const stateTeamDates = teamDateMap[currentMatch.stateTeam] || []; 
        const victimTeamDates = teamDateMap[currentMatch.victimTeam] || []; 

        if (stateTeamDates.includes(currentMatch.matchDate)){
            throw new Error(`Team ${currentMatch.stateTeam} is scheduled more than once on ${currentMatch.matchDate}.`);
        }

        if (victimTeamDates.includes(currentMatch.matchDate)){
            throw new Error(`Team ${currentMatch.victimTeam} is scheduled more than once on ${currentMatch.matchDate}`);
        }

        teamDateMap[currentMatch.stateTeam] = [
            ...stateTeamDates, 
            currentMatch.matchDate
        ];

        teamDateMap[currentMatch.victimTeam] = [
            ...victimTeamDates, 
            currentMatch.matchDate
        ];

        dailyMatchCount[currentMatch.matchDate] = dailyMatchCount[currentMatch.matchDate] + 1; 

        if (currentMatch.needsTranslation === true){
            if (currentMatch.matchDay === 'Monday'){
                throw new Error(`Translation match ${currentMatch.matchID} was scheduled on Monday`); 
            }

            const roomRecord = competitionRooms.find(currentRoom => {
                return currentRoom.roomNumber === currentMatch.roomNumber; 
            })

            if (!roomRecord || roomRecord.supportsTranslation !== true){
                throw new Error(`Translation match ${currentMatch.matchID} was scheduled in non-translation room ${currentMatch.roomNumber}.`);
            }

            const timeSlotIdentifier = createTimeSlotIdentifier(currentMatch); 
            const translationTypeIdentifier = createTranslationTypeIdentifier(currentMatch); 
            
            const scheduledTranslationTypes = translationTypeTimeMap[timeSlotIdentifier] || []; 
            if (scheduledTranslationTypes.includes(translationTypeIdentifier)){
                throw new Error(`Duplicate translation type ${translationTypeIdentifier} found at ${timeSlotIdentifier}.`);
            }

            translationTypeTimeMap[timeSlotIdentifier] = [
                ...scheduledTranslationTypes, 
                translationTypeIdentifier
            ];
        }
    }

    for (const currentDate in dailyMatchLimits){
        if (dailyMatchCount[currentDate] !== dailyMatchLimits[currentDate]){
            throw new Error(`Expected ${dailyMatchLimits[currentDate]} matches on ${currentDate}, but found ${dailyMatchCount[currentDate]}.`)
        }
    }

    console.log('Schedule validation passed.'); 
}

async function main() {
    const mongoClient = new MongoClient(process.env.MONGODB_URI_PROD);

    try {
        await mongoClient.connect();

        const competitionDatabase = mongoClient.db('IAMOOT-2026');
        const matchesCollection = competitionDatabase.collection('preliminaryMatches');

        const allMatches = await matchesCollection.find().toArray();

        if (allMatches.length === 0) {
            console.error(`No preliminary matches found.`);
            return;
        }

        const translationMatches = allMatches.filter(currentMatch => {
            return currentMatch.needsTranslation === true;
        });

        const regularMatches = allMatches.filter(currentMatch => {
            return currentMatch.needsTranslation !== true;
        });

        console.log(`Total matches found: ${allMatches.length}`);
        console.log(`Translation matches found: ${translationMatches.length}`);
        console.log(`Regular matches found: ${regularMatches.length}`);
        console.log();

        const translationEligibleSlots = generateTranslationEligibleSlots();
        const allAvailableSlots = generateAllAvailableSlots();

        console.log(`Translation-eligible slots available: ${translationEligibleSlots.length}`);
        console.log(`Total available slots: ${allAvailableSlots.length}`);
        console.log();

        const dailyMatchLimits = {
            '05-18-2026': 14,
            '05-19-2026': 15,
            '05-20-2026': 14
        };

        const validScheduleAttempt = findValidScheduleAttempt(translationMatches, regularMatches, translationEligibleSlots, allAvailableSlots, dailyMatchLimits, 5000);
        const scheduledMatches = validScheduleAttempt.scheduledMatches;
        const scheduleTrackers = validScheduleAttempt.scheduleTrackers;

        console.log(`Generated ${scheduledMatches.length} scheduled matches.`);
        console.log(`Daily match counts:`, scheduleTrackers.dailyMatchCount); 
        console.table(scheduledMatches.map(currentMatch => ({
            matchID: currentMatch.matchID, 
            translation: currentMatch.needsTranslation, 
            type: currentMatch.needsTranslation ? [...currentMatch.matchLanguages].sort().join('-') : 'Regular', 
            date: currentMatch.matchDate, 
            day: currentMatch.matchDay, 
            time: currentMatch.matchTime, 
            room: currentMatch.roomNumber
        })));

        validateScheduledMatches(scheduledMatches, dailyMatchLimits); 

        for ( const currentMatch of scheduledMatches){
            await matchesCollection.updateOne(
                { matchID: currentMatch.matchID }, 
                {
                    $set: {
                        matchDate: currentMatch.matchDate, 
                        matchDay: currentMatch.matchDay, 
                        matchTime: currentMatch.matchTime, 
                        roomNumber: currentMatch.roomNumber
                    }
                }
            );
        }

        console.log(`${scheduledMatches.length} preliminary matches updated with schedule data.`);

    } catch (error) {
        console.error('Error generating preliminary schedule:', error);
    } finally {
        await mongoClient.close();
    }

}

main(); 