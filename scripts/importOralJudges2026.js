require('dotenv').config();

const path = require('path');
const XLSX = require('xlsx');
const { connectToMongoDB, getCollection } = require('../db');

const JUDGES_FILE_PATH = path.join(__dirname, 'data', 'Judges-2026-toPopulateDB.xlsx');

function normalizeString(value) {
    if (value === undefined || value === null) {
        return '';
    }

    return String(value).trim();
}

function normalizeEmail(value) {
    const cleanedValue = normalizeString(value);

    if (
        !cleanedValue ||
        cleanedValue.toUpperCase() === 'N.A' ||
        cleanedValue.toUpperCase() === 'N/A' ||
        cleanedValue.toUpperCase() === 'NULL'
    ) {
        return '';
    }

    return cleanedValue.toLowerCase();
}

function normalizeLanguage(value) {
    const language = normalizeString(value).toUpperCase();

    if (!['EN', 'SPA', 'POR'].includes(language)) {
        return '';
    }

    return language;
}

function parseConflictOfInterest(value) {
    const cleanedValue = normalizeString(value);

    if (
        !cleanedValue ||
        cleanedValue.toUpperCase() === 'N.A' ||
        cleanedValue.toUpperCase() === 'N/A' ||
        cleanedValue.toUpperCase() === 'NULL'
    ) {
        return [];
    }

    return cleanedValue
        .split(/[,;|\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
            const numericValue = Number(item);
            return Number.isNaN(numericValue) ? item : numericValue;
        });
}

function readOralJudgesFromExcel() {
    const workbook = XLSX.readFile(JUDGES_FILE_PATH);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: ''
    });

    const judges = [];

    for (const row of rows) {
        const judgeID = Number(row.judgeID);
        const fullName = normalizeString(row.fullName);
        const primaryEmail = normalizeEmail(row.primaryEmail);
        const secondaryEmail = normalizeEmail(row.secondaryEmail);
        const currentLanguage = normalizeLanguage(row.currentLanguage);
        const conflictOfInterest = parseConflictOfInterest(row.conflictOfInterest);

        if (Number.isNaN(judgeID) || !fullName || !primaryEmail || !currentLanguage) {
            console.log(`Skipping invalid row: ${JSON.stringify(row)}`);
            continue;
        }

        judges.push({
            judgeID,
            fullName,
            primaryEmail,
            secondaryEmail,
            currentLanguage,
            currentRole: 'Judge',
            conflictOfInterest
        });
    }

    return judges;
}

async function main() {
    try {
        await connectToMongoDB();

        const oralJudgesCollection = getCollection('preliminaryJudges');
        const judges = readOralJudgesFromExcel();

        console.log(`Read ${judges.length} oral judges from Excel.`);

        const seenJudgeIDs = new Set();
        const seenEmails = new Set();

        let upsertedCount = 0;
        let skippedCount = 0;

        for (const judge of judges) {
            if (seenJudgeIDs.has(judge.judgeID)) {
                console.log(`Skipping duplicate judgeID in Excel: ${judge.judgeID}`);
                skippedCount += 1;
                continue;
            }

            if (seenEmails.has(judge.primaryEmail)) {
                console.log(`Skipping duplicate primaryEmail in Excel: ${judge.primaryEmail}`);
                skippedCount += 1;
                continue;
            }

            seenJudgeIDs.add(judge.judgeID);
            seenEmails.add(judge.primaryEmail);

            await oralJudgesCollection.updateOne(
                { judgeID: judge.judgeID },
                {
                    $set: {
                        judgeID: judge.judgeID,
                        fullName: judge.fullName,
                        primaryEmail: judge.primaryEmail,
                        secondaryEmail: judge.secondaryEmail,
                        currentLanguage: judge.currentLanguage,
                        currentRole: judge.currentRole,
                        conflictOfInterest: judge.conflictOfInterest,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        assignedOralRounds: [],
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );

            upsertedCount += 1;
        }

        console.log(`Done. Upserted ${upsertedCount} oral judges. Skipped ${skippedCount}.`);
        process.exit(0);
    } catch (error) {
        console.error('IMPORT ORAL JUDGES FAILED:', error);
        process.exit(1);
    }
}

main();