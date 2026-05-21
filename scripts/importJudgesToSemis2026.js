require('dotenv').config();

const path = require('path');
const XLSX = require('xlsx');
const { connectToMongoDB, getCollection } = require('../db');

const DEFAULT_FILE_PATH = path.join(__dirname, 'data', 'JudgesOralSemis2026.xlsx');

const APPLY_CHANGES = process.argv.includes('--apply');
const FILE_PATH = process.argv.find((arg) => arg.endsWith('.xlsx')) || DEFAULT_FILE_PATH;

function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function normalizeEmail(value) {
    const email = normalizeString(value).toLowerCase();

    if (
        !email ||
        email === 'n.a' ||
        email === 'n/a' ||
        email === 'null'
    ) {
        return '';
    }

    return email;
}

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;

    const text = normalizeString(value).toUpperCase();

    return text === 'TRUE' || text === 'YES' || text === 'Y' || text === '1';
}

function normalizeLanguage(value) {
    const text = normalizeString(value).toUpperCase();

    if (text === 'ENG' || text === 'EN') return 'EN';
    if (text === 'ESP' || text === 'SPA' || text === 'ES') return 'SPA';
    if (text === 'POR' || text === 'PT') return 'POR';

    return '';
}

function getLanguageBaseID(language) {
    if (language === 'EN') return 1000;
    if (language === 'SPA') return 2000;
    if (language === 'POR') return 3000;

    throw new Error(`Invalid language for ID assignment: ${language}`);
}

function getLanguageMaxID(language) {
    if (language === 'EN') return 1999;
    if (language === 'SPA') return 2999;
    if (language === 'POR') return 3999;

    throw new Error(`Invalid language for ID assignment: ${language}`);
}

function readRowsFromExcel() {
    const workbook = XLSX.readFile(FILE_PATH);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: ''
    });

    return rows.map((row, index) => ({
        rowNumber: index + 2,
        rawJudgeID: row.judgeID,
        judgeIDText: normalizeString(row.judgeID),
        fullName: normalizeString(row.fullName),
        primaryEmail: normalizeEmail(row.primaryEmail),
        participatesInSemifinals: normalizeBoolean(row.participatesInSemifinals)
    }));
}

function splitRows(rows) {
    const existingJudgeRows = [];
    const newJudgeRows = [];
    const skippedRows = [];

    for (const row of rows) {
        if (!row.fullName || !row.primaryEmail) {
            skippedRows.push({
                ...row,
                reason: 'Missing fullName or primaryEmail'
            });
            continue;
        }

        if (!row.participatesInSemifinals) {
            skippedRows.push({
                ...row,
                reason: 'participatesInSemifinals is not TRUE'
            });
            continue;
        }

        const numericJudgeID = Number(row.rawJudgeID);

        if (Number.isInteger(numericJudgeID)) {
            existingJudgeRows.push({
                ...row,
                judgeID: numericJudgeID
            });
            continue;
        }

        const currentLanguage = normalizeLanguage(row.rawJudgeID);

        if (!currentLanguage) {
            skippedRows.push({
                ...row,
                reason: `judgeID is neither a valid number nor valid language abbreviation: ${row.judgeIDText}`
            });
            continue;
        }

        newJudgeRows.push({
            ...row,
            currentLanguage
        });
    }

    return {
        existingJudgeRows,
        newJudgeRows,
        skippedRows
    };
}

function validateDuplicateExistingIDs(existingJudgeRows) {
    const seen = new Map();
    const duplicates = [];

    for (const row of existingJudgeRows) {
        if (seen.has(row.judgeID)) {
            duplicates.push({
                judgeID: row.judgeID,
                firstRow: seen.get(row.judgeID),
                duplicateRow: row
            });
        } else {
            seen.set(row.judgeID, row);
        }
    }

    if (duplicates.length > 0) {
        console.error('\nDUPLICATE NUMERIC judgeID VALUES FOUND IN EXCEL.');
        console.error('The script stopped to avoid overwriting the wrong existing judge.\n');

        for (const duplicate of duplicates) {
            console.error(`judgeID ${duplicate.judgeID}`);
            console.error(`  First row ${duplicate.firstRow.rowNumber}: ${duplicate.firstRow.fullName} <${duplicate.firstRow.primaryEmail}>`);
            console.error(`  Duplicate row ${duplicate.duplicateRow.rowNumber}: ${duplicate.duplicateRow.fullName} <${duplicate.duplicateRow.primaryEmail}>`);
        }

        console.error('\nFix the Excel file first, then run the dry run again.');
        process.exit(1);
    }
}

async function getNextFreeJudgeID(preliminaryJudgesCollection, language, reservedIDs) {
    const minID = getLanguageBaseID(language);
    const maxID = getLanguageMaxID(language);

    const existingJudges = await preliminaryJudgesCollection
        .find({
            judgeID: {
                $gte: minID,
                $lte: maxID
            }
        })
        .project({ judgeID: 1 })
        .toArray();

    const usedIDs = new Set(existingJudges.map((judge) => Number(judge.judgeID)));

    for (const reservedID of reservedIDs) {
        usedIDs.add(Number(reservedID));
    }

    for (let candidateID = minID; candidateID <= maxID; candidateID++) {
        if (!usedIDs.has(candidateID)) {
            reservedIDs.add(candidateID);
            return candidateID;
        }
    }

    throw new Error(`No free judge IDs available for language ${language}`);
}

async function main() {
    try {
        await connectToMongoDB();

        const preliminaryJudgesCollection = getCollection('preliminaryJudges');

        console.log('\n========================================');
        console.log('PRELIMINARY JUDGES SEMIFINALS UPDATE');
        console.log('========================================');
        console.log(`Mode: ${APPLY_CHANGES ? 'APPLY CHANGES' : 'DRY RUN ONLY'}`);
        console.log(`Excel file: ${FILE_PATH}`);

        const rows = readRowsFromExcel();

        const {
            existingJudgeRows,
            newJudgeRows,
            skippedRows
        } = splitRows(rows);

        validateDuplicateExistingIDs(existingJudgeRows);

        const existingJudgeIDsFromExcel = existingJudgeRows.map((row) => row.judgeID);

        const existingJudgesInDB = await preliminaryJudgesCollection
            .find({
                judgeID: {
                    $in: existingJudgeIDsFromExcel
                }
            })
            .project({
                judgeID: 1,
                fullName: 1,
                primaryEmail: 1,
                participatesInSemifinals: 1
            })
            .toArray();

        const existingJudgeMap = new Map(
            existingJudgesInDB.map((judge) => [Number(judge.judgeID), judge])
        );

        const missingExistingRows = [];
        const updatePlans = [];

        for (const row of existingJudgeRows) {
            const existingJudge = existingJudgeMap.get(row.judgeID);

            if (!existingJudge) {
                missingExistingRows.push(row);
                continue;
            }

            updatePlans.push({
                judgeID: row.judgeID,
                oldFullName: existingJudge.fullName || '',
                newFullName: row.fullName,
                oldPrimaryEmail: existingJudge.primaryEmail || '',
                newPrimaryEmail: row.primaryEmail,
                participatesInSemifinals: true
            });
        }

        const reservedNewIDs = new Set();
        const insertPlans = [];

        for (const row of newJudgeRows) {
            const newJudgeID = await getNextFreeJudgeID(
                preliminaryJudgesCollection,
                row.currentLanguage,
                reservedNewIDs
            );

            insertPlans.push({
                judgeID: newJudgeID,
                fullName: row.fullName,
                primaryEmail: row.primaryEmail,
                secondaryEmail: '',
                currentLanguage: row.currentLanguage,
                currentRole: 'Judge',
                assignedOralRounds: [],
                conflictOfInterest: [],
                participatesInSemifinals: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        const currentSemisJudges = await preliminaryJudgesCollection.countDocuments({
            participatesInSemifinals: true
        });

        const currentSemisJudgeIDsFromExcel = await preliminaryJudgesCollection.countDocuments({
            judgeID: { $in: updatePlans.map((plan) => plan.judgeID) },
            participatesInSemifinals: true
        });

        const projectedTotalSemis =
            currentSemisJudges -
            currentSemisJudgeIDsFromExcel +
            updatePlans.length +
            insertPlans.length;

        console.log('\n------------- SUMMARY -------------');
        console.log(`Rows read from Excel: ${rows.length}`);
        console.log(`Existing judges to update: ${updatePlans.length}`);
        console.log(`New judges to insert: ${insertPlans.length}`);
        console.log(`Skipped rows: ${skippedRows.length}`);
        console.log(`Existing Excel judgeIDs not found in DB: ${missingExistingRows.length}`);
        console.log(`Current judges already marked participatesInSemifinals=true in DB: ${currentSemisJudges}`);
        console.log(`Projected total judges with participatesInSemifinals=true after apply: ${projectedTotalSemis}`);

        console.log('\n------------- EXISTING JUDGES TO UPDATE -------------');
        if (updatePlans.length === 0) {
            console.log('None');
        } else {
            for (const plan of updatePlans) {
                console.log(
                    `judgeID ${plan.judgeID}: ` +
                    `${plan.oldFullName} <${plan.oldPrimaryEmail}>` +
                    `  ->  ${plan.newFullName} <${plan.newPrimaryEmail}>` +
                    ` | participatesInSemifinals=true`
                );
            }
        }

        console.log('\n------------- NEW JUDGES TO INSERT -------------');
        if (insertPlans.length === 0) {
            console.log('None');
        } else {
            for (const plan of insertPlans) {
                console.log(
                    `NEW judgeID ${plan.judgeID} (${plan.currentLanguage}): ` +
                    `${plan.fullName} <${plan.primaryEmail}>`
                );
            }
        }

        console.log('\n------------- EXISTING EXCEL judgeIDs NOT FOUND IN DB -------------');
        if (missingExistingRows.length === 0) {
            console.log('None');
        } else {
            for (const row of missingExistingRows) {
                console.log(
                    `Row ${row.rowNumber}: judgeID ${row.judgeID}, ${row.fullName} <${row.primaryEmail}>`
                );
            }
        }

        console.log('\n------------- SKIPPED ROWS -------------');
        if (skippedRows.length === 0) {
            console.log('None');
        } else {
            for (const row of skippedRows) {
                console.log(
                    `Row ${row.rowNumber}: ${row.fullName || '(missing name)'} ` +
                    `<${row.primaryEmail || 'missing email'}> | Reason: ${row.reason}`
                );
            }
        }

        if (!APPLY_CHANGES) {
            console.log('\nDRY RUN COMPLETE. No database changes were made.');
            console.log('After reviewing the output, run with --apply to modify the database:');
            console.log('node scripts/updatePreliminaryJudgesSemis2026.js --apply');
            process.exit(0);
        }

        console.log('\nAPPLYING CHANGES...');

        for (const plan of updatePlans) {
            await preliminaryJudgesCollection.updateOne(
                { judgeID: plan.judgeID },
                {
                    $set: {
                        fullName: plan.newFullName,
                        primaryEmail: plan.newPrimaryEmail,
                        participatesInSemifinals: true,
                        updatedAt: new Date()
                    }
                }
            );
        }

        if (insertPlans.length > 0) {
            await preliminaryJudgesCollection.insertMany(insertPlans);
        }

        console.log('\nDONE.');
        console.log(`Updated existing judges: ${updatePlans.length}`);
        console.log(`Inserted new judges: ${insertPlans.length}`);
        console.log(`Projected semifinals judges total: ${projectedTotalSemis}`);

        process.exit(0);
    } catch (error) {
        console.error('\nUPDATE PRELIMINARY JUDGES SEMIS FAILED:', error);
        process.exit(1);
    }
}

main();