require('dotenv').config();

const { connectToMongoDB, getCollection} = require('../db');
const { getDropboxClient} = require('../services/dropboxClient');

const DROPBOX_FOLDER_PATH = '/Testing for Developers';
const DEFAULT_MINIMUM_JUDGES = 7;
const DEFAULT_MAXIMUM_JUDGES = 9;

function parseMemorandumID(fileName) {
    const memorandumID = fileName.replace(/\.docx$/i, '').trim().toUpperCase();

    const suffix = memorandumID.slice(-1);
    const teamID = memorandumID.slice(0, -1);

    let status = null;

    if (suffix === 'V') {
        status = 'Victim';
    } else if (suffix === 'S' || suffix === 'E') {
        status = 'State';
    }

    return {
        memorandumID,
        teamID,
        status
    };
}

async function listAllDropboxFiles(dbx, dropboxPath) {
    let allEntries = [];

    let response = await dbx.filesListFolder({ path: dropboxPath });
    allEntries.push(...response.result.entries);

    while (response.result.has_more) {
        response = await dbx.filesListFolderContinue( {
            cursor: response.result.cursor
        });
        allEntries.push(...response.result.entries);
    }

    return allEntries;
}

async function getOrCreateSharedLink(dbx,dropboxPath) {
    const existingLinks = await dbx.sharingListSharedLinks({
        path: dropboxPath,
        direct_only: true
    });

    if (existingLinks.result.links.length > 0) {
        return existingLinks.result.links[0].url;
    }

    const newLink = await dbx.sharingCreateSharedLinkWithSettings({
        path: dropboxPath
    });

    return newLink.result.url;
}

async function main() {
    try {
        await connectToMongoDB();

        const memorandaCollection = getCollection('memoranda');
        const teamsCollection = getCollection('teams');
        const dbx = await getDropboxClient();

        const entries = await listAllDropboxFiles(dbx, DROPBOX_FOLDER_PATH);

        const docxFiles = entries.filter((entry) => {
            return entry['.tag'] === 'file' && /\.docx$/i.test(entry.name);
        });

        console.log(`Found ${docxFiles.length} .docx files in Dropbox.`);

        let upsertedCount = 0;
        let skippedCount = 0;

        for (const file of docxFiles) {
            const { memorandumID, teamID, status } = parseMemorandumID(file.name);

            if (!memorandumID || !teamID || !status) {
                console.log(`Skipping invalid memorandum filename: ${file.name}`);
                skippedCount += 1;
                continue;
            }

            const matchingTeam = await teamsCollection.findOne({ teamID: String(teamID) });

            if (!matchingTeam) {
                console.log(`Skipping ${memorandumID}: no matching team found for teamID  ${teamID}`);
                skippedCount += 1;
                continue;
            }

            const language = matchingTeam.teamLanguage || null;
            const dropboxPath = file.path_display || `${DROPBOX_FOLDER_PATH}/${file.name}`;
            const sharedLink = await getOrCreateSharedLink(dbx, file.path_lower || dropboxPath);

            await memorandaCollection.updateOne(
                {memorandumID},
                {
                    $set: {
                        memorandumID,
                        teamID: String(teamID),
                        language, 
                        status,
                        minimumJudges: DEFAULT_MINIMUM_JUDGES,
                        maximumJudges: DEFAULT_MAXIMUM_JUDGES,
                        dropboxPath,
                        sharedLink,
                        updateAt: new Date()
                    },
                    $setOnInsert: {
                        assignedJudgeIDs: [],
                        scoresByJudge: [],
                        createdAt: new Date()
                    }
                },
                { upsert: true}
            );

            upsertedCount += 1;
            console.log(`Upserted ${memorandumID} (${language}, ${status})`);
        }

        console.log(`Done. Upserted ${upsertedCount} memoranda. Skipped ${skippedCount}.`);
        process.exit(0);
    } catch (error) {
        console.error('IMPORT FAILED:', error);
        process.exit(1);
    }
}

main();

