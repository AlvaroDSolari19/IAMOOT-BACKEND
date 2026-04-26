require('dotenv').config();

const { connectToMongoDB, getCollection } = require('../db');

const MIN_JUDGES_PER_MEMORANDUM = 7;
const MAX_JUDGES_PER_MEMORANDUM = 9;
const MIN_MEMORANDUMS_PER_JUDGE = 3;
const DEFAULT_MAX_MEMORANDUMS_PER_JUDGE = 5;

function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

function getJudgeMaxMemorandums(judge) {
    if (typeof judge.maxMemorandums === 'number' && judge.maxMemorandums > 0) {
        return judge.maxMemorandums;
    }

    return DEFAULT_MAX_MEMORANDUMS_PER_JUDGE;
}

function groupByLanguage(items, languageField) {
    const grouped = {};

    for (const item of items) {
        const language = String(item[languageField] || '').trim().toUpperCase();

        if (!grouped[language]) {
            grouped[language] = [];
        }

        grouped[language].push(item);
    }

    return grouped;
}

function assignMemoToJudge(judge, memorandum) {
    if (judge.assignedMemorandums.includes(memorandum.memorandumID)) {
        return false;
    }

    if (memorandum.assignedJudgeIDs.includes(judge.judgeID)) {
        return false;
    }

    if (judge.assignedMemorandums.length >= getJudgeMaxMemorandums(judge)) {
        return false;
    }

    if (memorandum.assignedJudgeIDs.length >= MAX_JUDGES_PER_MEMORANDUM) {
        return false;
    }

    judge.assignedMemorandums.push(memorandum.memorandumID);
    memorandum.assignedJudgeIDs.push(judge.judgeID);

    return true;
}

async function main() {
    try {
        await connectToMongoDB();

        const writtenJudgesCollection = getCollection('writtenJudges');
        const memorandaCollection = getCollection('memoranda');

        const allJudges = await writtenJudgesCollection.find({
            currentRole: 'Judge'
        }).toArray();

        const allMemoranda = await memorandaCollection.find({}).toArray();

        console.log(`Fetched ${allJudges.length} written judges.`);
        console.log(`Fetched ${allMemoranda.length} memoranda.`);

        const preparedJudges = allJudges.map((judge) => ({
            ...judge,
            currentLanguage: String(judge.currentLanguage || '').trim().toUpperCase(),
            assignedMemorandums: []
        }));

        const preparedMemoranda = allMemoranda.map((memorandum) => ({
            ...memorandum,
            language: String(memorandum.language || '').trim().toUpperCase(),
            assignedJudgeIDs: []
        }));

        const judgesByLanguage = groupByLanguage(preparedJudges, 'currentLanguage');
        const memorandaByLanguage = groupByLanguage(preparedMemoranda, 'language');

        const allLanguages = new Set([
            ...Object.keys(judgesByLanguage),
            ...Object.keys(memorandaByLanguage)
        ]);

        for (const language of allLanguages) {
            const groupedJudges = shuffleArray(judgesByLanguage[language] || []);
            const groupedMemoranda = shuffleArray(memorandaByLanguage[language] || []);

            console.log(`\n--- Assigning language ${language} ---`);
            console.log(`Judges: ${groupedJudges.length}`);
            console.log(`Memoranda: ${groupedMemoranda.length}`);

            if (groupedJudges.length === 0 || groupedMemoranda.length === 0) {
                console.warn(`Skipping ${language}: missing judges or memoranda.`);
                continue;
            }

            const minimumJudgeAssignmentsNeeded = groupedJudges.length * MIN_MEMORANDUMS_PER_JUDGE;
            const maximumMemoCapacity = groupedMemoranda.length * MAX_JUDGES_PER_MEMORANDUM;
            const minimumMemoAssignmentsNeeded = groupedMemoranda.length * MIN_JUDGES_PER_MEMORANDUM;
            const maximumJudgeCapacity = groupedJudges.reduce((sum, judge) => {
                return sum + getJudgeMaxMemorandums(judge);
            }, 0);

            if (minimumJudgeAssignmentsNeeded > maximumMemoCapacity) {
                console.warn(
                    `WARNING: Impossible to give every ${language} judge ${MIN_MEMORANDUMS_PER_JUDGE} memoranda with current memo max. ` +
                    `Need ${minimumJudgeAssignmentsNeeded} judge assignments, but memo capacity is only ${maximumMemoCapacity}.`
                );
            }

            if (minimumMemoAssignmentsNeeded > maximumJudgeCapacity) {
                console.warn(
                    `WARNING: Impossible to give every ${language} memorandum ${MIN_JUDGES_PER_MEMORANDUM} judges with current judge max. ` +
                    `Need ${minimumMemoAssignmentsNeeded} memo assignments, but judge capacity is only ${maximumJudgeCapacity}.`
                );
            }

            // Step 1: prioritize giving every judge at least 3 memoranda.
            for (const judge of groupedJudges) {
                while (judge.assignedMemorandums.length < MIN_MEMORANDUMS_PER_JUDGE) {
                    const availableMemoranda = groupedMemoranda
                        .filter((memorandum) => {
                            return !judge.assignedMemorandums.includes(memorandum.memorandumID) &&
                                memorandum.assignedJudgeIDs.length < MAX_JUDGES_PER_MEMORANDUM;
                        })
                        .sort((a, b) => a.assignedJudgeIDs.length - b.assignedJudgeIDs.length);

                    if (availableMemoranda.length === 0) {
                        console.warn(
                            `No memorandum left to assign for judge ${judge.judgeID} - ${judge.fullName} (${language}).`
                        );
                        break;
                    }

                    assignMemoToJudge(judge, availableMemoranda[0]);
                }
            }

            // Step 2: bring each memorandum up to at least 7 judges when possible.
            for (const memorandum of groupedMemoranda) {
                while (memorandum.assignedJudgeIDs.length < MIN_JUDGES_PER_MEMORANDUM) {
                    const availableJudges = groupedJudges
                        .filter((judge) => {
                            return judge.assignedMemorandums.length < getJudgeMaxMemorandums(judge) &&
                                !judge.assignedMemorandums.includes(memorandum.memorandumID);
                        })
                        .sort((a, b) => a.assignedMemorandums.length - b.assignedMemorandums.length);

                    if (availableJudges.length === 0) {
                        console.warn(
                            `Could not reach ${MIN_JUDGES_PER_MEMORANDUM} judges for memorandum ${memorandum.memorandumID} (${language}).`
                        );
                        break;
                    }

                    assignMemoToJudge(availableJudges[0], memorandum);
                }
            }

            // Step 3: optional balancing pass.
            // This tries to give underloaded judges extra memoranda if there is memo capacity.
            for (const judge of groupedJudges) {
                while (judge.assignedMemorandums.length < MIN_MEMORANDUMS_PER_JUDGE) {
                    const availableMemoranda = groupedMemoranda
                        .filter((memorandum) => {
                            return !judge.assignedMemorandums.includes(memorandum.memorandumID) &&
                                memorandum.assignedJudgeIDs.length < MAX_JUDGES_PER_MEMORANDUM;
                        })
                        .sort((a, b) => a.assignedJudgeIDs.length - b.assignedJudgeIDs.length);

                    if (availableMemoranda.length === 0) {
                        break;
                    }

                    assignMemoToJudge(judge, availableMemoranda[0]);
                }
            }
        }

        let updatedJudges = 0;
        let updatedMemoranda = 0;

        for (const judge of preparedJudges) {
            await writtenJudgesCollection.updateOne(
                { judgeID: judge.judgeID },
                {
                    $set: {
                        assignedMemorandums: judge.assignedMemorandums,
                        updatedAt: new Date()
                    }
                }
            );

            updatedJudges += 1;
        }

        for (const memorandum of preparedMemoranda) {
            await memorandaCollection.updateOne(
                { memorandumID: memorandum.memorandumID },
                {
                    $set: {
                        assignedJudgeIDs: memorandum.assignedJudgeIDs,
                        minimumJudges: MIN_JUDGES_PER_MEMORANDUM,
                        maximumJudges: MAX_JUDGES_PER_MEMORANDUM,
                        updatedAt: new Date()
                    }
                }
            );

            updatedMemoranda += 1;
        }

        console.log(`\nDone. Updated ${updatedJudges} judges and ${updatedMemoranda} memoranda.`);

        const judgesUnderMinimum = preparedJudges.filter((judge) => {
            return judge.assignedMemorandums.length < MIN_MEMORANDUMS_PER_JUDGE;
        });

        const memorandaUnderMinimum = preparedMemoranda.filter((memorandum) => {
            return memorandum.assignedJudgeIDs.length < MIN_JUDGES_PER_MEMORANDUM;
        });

        const memorandaUnderMaximum = preparedMemoranda.filter((memorandum) => {
            return memorandum.assignedJudgeIDs.length < MAX_JUDGES_PER_MEMORANDUM;
        });

        console.log('\n===== FINAL ASSIGNMENT AUDIT =====');

        console.log(`Judges with fewer than ${MIN_MEMORANDUMS_PER_JUDGE} memoranda: ${judgesUnderMinimum.length}`);
        for (const judge of judgesUnderMinimum) {
            console.log(
                `Judge ${judge.judgeID} | ${judge.fullName} | ${judge.currentLanguage} | assigned: ${judge.assignedMemorandums.length} | memos: ${judge.assignedMemorandums.join(', ')}`
            );
        }

        console.log(`\nMemoranda with fewer than ${MIN_JUDGES_PER_MEMORANDUM} judges: ${memorandaUnderMinimum.length}`);
        for (const memorandum of memorandaUnderMinimum) {
            console.log(
                `Memo ${memorandum.memorandumID} | ${memorandum.language} | judges: ${memorandum.assignedJudgeIDs.length} | judgeIDs: ${memorandum.assignedJudgeIDs.join(', ')}`
            );
        }

        console.log(`\nMemoranda with fewer than ${MAX_JUDGES_PER_MEMORANDUM} judges: ${memorandaUnderMaximum.length}`);
        for (const memorandum of memorandaUnderMaximum) {
            console.log(
                `Memo ${memorandum.memorandumID} | ${memorandum.language} | judges: ${memorandum.assignedJudgeIDs.length} | judgeIDs: ${memorandum.assignedJudgeIDs.join(', ')}`
            );
        }

        process.exit(0);
    } catch (error) {
        console.error('ASSIGN WRITTEN JUDGES FAILED:', error);
        process.exit(1);
    }
}

main();