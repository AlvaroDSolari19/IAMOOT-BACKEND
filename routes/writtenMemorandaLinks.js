const express = require('express');
const router = express.Router();

const { getDropboxClient } = require('../services/dropboxClient');

async function getOrCreateSharedLink(dropboxClient, dropboxPath) {
    const existingLinks = await dropboxClient.sharingListSharedLinks({
        path: dropboxPath,
        direct_only: true
    });

    if (existingLinks.result.links.length > 0) {
        return existingLinks.result.links[0].url;
    }

    const newLink = await dropboxClient.sharingCreateSharedLinkWithSettings({
        path: dropboxPath
    });

    return newLink.result.url;
}

/*****************************************
 * GET MEMORANDUM DROPBOX SHARED LINK
 *****************************************/
router.get('/written-memoranda/:memorandumID/link', async (req, res) => {
    let dropboxPath = '';

    try {
        const rawMemorandumID = String(req.params.memorandumID || '').trim().toUpperCase();

        if (!rawMemorandumID) {
            return res.status(400).json({
                ok: false,
                message: 'Missing memorandum ID'
            });
        }

        const memorandumPattern = /^\d{3}[SV]$/;

        if (!memorandumPattern.test(rawMemorandumID)) {
            return res.status(400).json({
                ok: false,
                message: 'Invalid memorandum ID format'
            });
        }

        dropboxPath = `/Testing for Developers/${rawMemorandumID}.docx`;

        const dropboxClient = await getDropboxClient();
        const sharedLink = await getOrCreateSharedLink(dropboxClient, dropboxPath);

        return res.status(200).json({
            ok: true,
            memorandumID: rawMemorandumID,
            dropboxPath,
            sharedLink
        });
    } catch (memorandumLinkError) {
        console.error('MEMORANDUM LINK ERROR:', memorandumLinkError);

        return res.status(500).json({
            ok: false,
            message: 'Unable to get memorandum link',
            error: memorandumLinkError?.message || String(memorandumLinkError),
            details: memorandumLinkError?.error || null,
            dropboxPath
        });
    }
});

module.exports = router;