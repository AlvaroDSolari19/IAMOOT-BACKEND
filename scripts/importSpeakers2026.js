require('dotenv').config();

const path = require('path');
const XLSX = require('xlsx');
const { connectToMongoDB, getCollection } = require('../db');

const TEAMS_FILE_PATH = path.join(__dirname, 'data', 'FINAL-TeamRegistration.xlsx');

function normalizeString(value) {
    if (value === undefined || value === null) {
        return '';
    }

    return String(value).trim();
}

function normalizeLanguage(value) {
    const language = normalizeString(value).toUpperCase();

    if (!['EN', 'SPA', 'POR'].includes(language)) {
        return '';
    }

    return language;
}

function isFalseLike(value) {
    const normalizedValue = normalizeString(value).toLowerCase();

    return ['false', '0', 'no', 'n'].includes(normalizedValue);
}

function readSpeakersFromExcel() {
    const workbook = XLSX.readFile(TEAMS_FILE_PATH);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: ''
    });

    const speakers = [];
    const seenSpeakerIDs = new Set();

    let skippedRows = 0;

    for (const row of rows) {
        const teamID = Number(row.TeamNumber);
        const fullSchoolName = normalizeString(row.FullSchoolName);
        const speakerLanguage = normalizeLanguage(row.Language);
        const isParticipating = row.isParticipating;

        const participantA = normalizeString(row.participantA);
        const participantB = normalizeString(row.participantB);

        if (!Number.isFinite(teamID) || !fullSchoolName || !speakerLanguage) {
            skippedRows += 1;
            console.log(`Skipping invalid or incomplete team row: ${JSON.stringify(row)}`);
            continue;
        }

        if (isFalseLike(isParticipating)) {
            skippedRows += 1;
            console.log(`Skipping non-participating team ${teamID}: ${fullSchoolName}`);
            continue;
        }

        if (participantA) {
            const speakerID = `${teamID}A`;

            if (!seenSpeakerIDs.has(speakerID)) {
                speakers.push({
                    speakerID,
                    speakerName: participantA,
                    speakerLanguage,
                    teamID,
                    receivedScores: [],
                    averageScores: [],
                    preliminaryAverageScore: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                seenSpeakerIDs.add(speakerID);
            }
        }

        if (participantB) {
            const speakerID = `${teamID}B`;

            if (!seenSpeakerIDs.has(speakerID)) {
                speakers.push({
                    speakerID,
                    speakerName: participantB,
                    speakerLanguage,
                    teamID,
                    receivedScores: [],
                    averageScores: [],
                    preliminaryAverageScore: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                seenSpeakerIDs.add(speakerID);
            }
        }
    }

    speakers.sort((speakerOne, speakerTwo) => {
        if (speakerOne.teamID !== speakerTwo.teamID) {
            return speakerOne.teamID - speakerTwo.teamID;
        }

        return speakerOne.speakerID.localeCompare(speakerTwo.speakerID);
    });

    return {
        speakers,
        skippedRows
    };
}

async function main() {
    try {
        await connectToMongoDB();

        const speakersCollection = getCollection('speakers');

        const { speakers, skippedRows } = readSpeakersFromExcel();

        console.log(`Read ${speakers.length} speakers from Excel.`);
        console.log(`Skipped ${skippedRows} team rows.`);

        if (speakers.length === 0) {
            throw new Error('No valid speakers found. Refusing to clear speakers collection.');
        }

        await speakersCollection.deleteMany({});
        console.log('Cleared speakers collection.');

        await speakersCollection.createIndex(
            { speakerID: 1 },
            { unique: true }
        );

        const result = await speakersCollection.insertMany(speakers);

        console.log(`Done. Inserted ${result.insertedCount} speakers.`);
        process.exit(0);
    } catch (error) {
        console.error('IMPORT SPEAKERS 2026 FAILED:', error);
        process.exit(1);
    }
}

main();