const XLSX = require('xlsx');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith('--'));
const isDryRun = args.includes('--dry-run');
const shouldClearCollection = args.includes('--clear');

if (!filePath) {
  console.error(
    'Usage: node scripts/importTeams2026Safe.js <path_to_excel_file.xlsx> [--dry-run] [--clear]'
  );
  process.exit(1);
}

const MONGO_URI = process.env.MONGODB_URI_PROD;
const DB_NAME = 'IAMOOT-2026';
const COLLECTION_NAME = 'teams';

if (!MONGO_URI) {
  console.error('Missing MONGODB_URI_PROD in .env');
  process.exit(1);
}

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isUsableEmailValue(value) {
  const cleaned = normalizeValue(value);
  if (!cleaned) return false;

  const invalidValues = ['N/A', 'NA', 'NONE', 'NULL', '-'];
  return !invalidValues.includes(cleaned.toUpperCase());
}

function looksLikeEmail(value) {
  const cleaned = normalizeValue(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

function extractEmailsFromRow(row) {
  const emails = [];

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeValue(key);

    // Only capture columns like "Email 2", "Email 3", etc.
    if (!/^Email/i.test(normalizedKey)) continue;
    if (!isUsableEmailValue(value)) continue;

    const raw = normalizeValue(value);

    // Split cells that may contain multiple emails
    const parts = raw
      .split(/[\/,;]+/)
      .map((item) => normalizeValue(item))
      .filter((item) => isUsableEmailValue(item) && looksLikeEmail(item));

    emails.push(...parts);
  }

  return [...new Set(emails)];
}

function transformRow(row) {
  return {
    participantEmails: extractEmailsFromRow(row),
    teamID: normalizeValue(row['Team Number']),
    universityName: normalizeValue(row['Full School Name']),
    teamLanguage: normalizeValue(row['Language']),
  };
}

function validateDocument(doc) {
  if (!doc.teamID) return 'Missing teamID';
  if (!doc.universityName) return 'Missing universityName';
  if (!doc.teamLanguage) return 'Missing teamLanguage';
  if (!Array.isArray(doc.participantEmails) || doc.participantEmails.length === 0) {
    return 'No valid participant emails found';
  }
  return null;
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawData.length) {
      console.log('No rows found in the Excel file.');
      return;
    }

    const validDocs = [];
    const skippedRows = [];
    const duplicateTeamIdsInExcel = new Set();
    const seenTeamIdsInExcel = new Set();

    rawData.forEach((row, index) => {
      const excelRow = index + 2; // header is row 1
      const doc = transformRow(row);
      const validationError = validateDocument(doc);

      if (validationError) {
        skippedRows.push({
          excelRow,
          teamID: normalizeValue(row['Team Number']),
          reason: validationError,
        });
        return;
      }

      if (seenTeamIdsInExcel.has(doc.teamID)) {
        duplicateTeamIdsInExcel.add(doc.teamID);
        skippedRows.push({
          excelRow,
          teamID: doc.teamID,
          reason: 'Duplicate teamID found inside Excel file',
        });
        return;
      }

      seenTeamIdsInExcel.add(doc.teamID);
      validDocs.push(doc);
    });

    if (duplicateTeamIdsInExcel.size > 0) {
      console.log('Duplicate teamIDs found in Excel:');
      console.log([...duplicateTeamIdsInExcel]);
    }

    if (!validDocs.length) {
      console.log('No valid documents found to process.');
      if (skippedRows.length) {
        console.log('\nSkipped rows:');
        console.log(skippedRows);
      }
      return;
    }

    const incomingTeamIds = validDocs.map((doc) => doc.teamID);
    const existingDocs = await collection
      .find({ teamID: { $in: incomingTeamIds } }, { projection: { teamID: 1 } })
      .toArray();

    const existingTeamIds = new Set(existingDocs.map((doc) => doc.teamID));

    const docsToInsert = validDocs.filter((doc) => !existingTeamIds.has(doc.teamID));
    const skippedExisting = validDocs
      .filter((doc) => existingTeamIds.has(doc.teamID))
      .map((doc) => ({
        teamID: doc.teamID,
        reason: 'teamID already exists in database',
      }));

    console.log(`Rows read from Excel: ${rawData.length}`);
    console.log(`Valid rows after parsing: ${validDocs.length}`);
    console.log(`Already existing in DB: ${skippedExisting.length}`);
    console.log(`Rows skipped for validation/duplicates: ${skippedRows.length}`);
    console.log(`Ready to insert: ${docsToInsert.length}`);
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE INSERT'}`);

    if (docsToInsert.length > 0) {
      console.log('\nSample documents to insert:');
      console.log(docsToInsert.slice(0, 3));
    }

    if (skippedRows.length > 0) {
      console.log('\nSkipped rows from Excel:');
      console.log(skippedRows);
    }

    if (skippedExisting.length > 0) {
      console.log('\nSkipped because already in database:');
      console.log(skippedExisting.slice(0, 20));
    }

    if (isDryRun) {
      console.log('\nDry run complete. No documents were inserted.');
      return;
    }

    if (shouldClearCollection) {
      const deleteResult = await collection.deleteMany({});
      console.log(`\nCollection cleared. Deleted ${deleteResult.deletedCount} existing documents.`);
    } else if (skippedExisting.length > 0) {
      console.log(
        '\nInsert stopped because duplicates already exist in the database and --clear was not used.'
      );
      console.log('This is intentional for safety.');
      return;
    }

    if (!docsToInsert.length && !shouldClearCollection) {
      console.log('\nNothing new to insert.');
      return;
    }

    let finalDocsToInsert = docsToInsert;

    if (shouldClearCollection) {
      // After clearing, insert all valid docs again
      finalDocsToInsert = validDocs;
    }

    if (!finalDocsToInsert.length) {
      console.log('\nNo documents to insert after processing.');
      return;
    }

    const result = await collection.insertMany(finalDocsToInsert);
    console.log(
      `\nSuccessfully inserted ${result.insertedCount} documents into ${DB_NAME}.${COLLECTION_NAME}.`
    );
  } catch (error) {
    console.error('Error importing teams:', error);
  } finally {
    await client.close();
  }
}

main();