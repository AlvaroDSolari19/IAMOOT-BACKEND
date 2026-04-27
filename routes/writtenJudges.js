const express = require('express'); 
const router = express.Router(); 

const {
    loginJudge, 
    requestJudgePassword, 
    setJudgePassword
} = require('../services/judgeAuthService'); 

const requireJudgeAuth = require('../middleware/requireJudgeAuth');
const { getCollection } = require('../db');

/*********
 * LOGIN *
 *********/
router.post('/written-judges/login', (req, res) => {
    loginJudge(req, res, { collectionName: 'writtenJudges' });
});

/*****************************
 * REQUEST SET PASSWORD LINK *
 *****************************/
router.post('/written-judges/request-password', (req,res) => {
    requestJudgePassword(req, res, { collectionName: 'writtenJudges' });
});

/****************
 * SET PASSWORD * 
 ****************/
router.post('/written-judges/set-password', (req, res) => {
    setJudgePassword(req, res, { collectionName: 'writtenJudges' });
});

/********************
 * GET JUDGE RECORD *
 ********************/
router.get('/written-judges/me', requireJudgeAuth, async (req, res) => {
    try {
        const judgeID = req.authJudgeID; 

        const judgesCollection = getCollection('writtenJudges');
        const memorandaCollection = getCollection('memoranda')
        
        const judgeRecord = await judgesCollection.findOne({ judgeID });

        if (!judgeRecord) {
            return res.status(404).json({
                ok: false,
                message: 'Judge not found'
            });
        }

        const assignedMemorandums = judgeRecord.assignedMemorandums || [];

        const memoranda = await memorandaCollection
            .find({
                memorandumID: { $in: assignedMemorandums }
            })
            .project({
                _id: 0,
                memorandumID: 1,
                teamID: 1, 
                status: 1,
                language: 1,
                sharedLink: 1,
                dropboxPath: 1,
                scoresByJudge:1
            })
            .toArray();

        const availableMemoranda = memoranda.filter((memo) => {
            const scoresByJudge = memo.scoresByJudge || [];

            const alreadySubmitted = scoresByJudge.some((scoreEntry) => {
                return Number(scoreEntry.judgeID) ===  Number(judgeID);
            });

            return !alreadySubmitted;
        });

        return res.json({ 
            ok: true, 
            judge: {
                judgeID: judgeRecord.judgeID,
                fullName: judgeRecord.fullName,
                currentLanguage: 
                judgeRecord.currentLanguage,
                currentRole: judgeRecord.currentRole
            },
            memoranda: availableMemoranda
            
        });
    }   catch (error) {
        console.error('ERROR FETCHING JUDGE MEMORANDA:', error);
        return res.status(500).json({
            ok: false,
            message: 'Server error while fetching judge memoranda'
        });
    }
});

module.exports = router; 

/**
 * GET 
 */