const express = require('express');
const router = express.Router();

const requireJudgeAuth = require('../middleware/requireJudgeAuth');
const { getCollection } = require('../db');

const {
    loginJudge,
    requestJudgePassword,
    setJudgePassword,
} = require('../services/judgeAuthService');

/********
 * LOGIN *
 *******/
router.post('/oral-judges/login', (req, res) => {
    return loginJudge(req, res, {
        collectionName: 'oralJudges'
    });
});

/****************************
 * REQUEST SET PASSWORD LINK*
 ****************************/
router.post('/oral-judges/request-password', (req, res) => {
    return requestJudgePassword(req, res, {
        collectionName: 'oralJudges',
        frontendBaseURL: process.env.FRONTEND_BASE_URL
    });
});

/****************
 * SET PASSWORD *
 ****************/
router.post('/oral-judges/set-password', (req, res) => {
    return setJudgePassword(req, res,{
        collectionName: 'oralJudges'
    });
});

/****************************
 *  GET AUTHENTICATED JUDGE *
 ***************************/
router.get('/oral-judges/me', requireJudgeAuth, async (req, res) =>{
    try {
        const judgesCollection = getCollection('oralJudges');

        const judgeRecord = await judgesCollection.findOne(
            { judgeID: Number(req.authJudgeID) },
            {
                projection: {
                    passwordHash: 0,
                    resetTokenHash: 0,
                    resetTokenExpiresAt: 0,
                    resetTokenCreatedAt: 0
                }
            }
        );

        if (!judgeRecord) {
            return res.status(404).json({ 
                ok: false,
                message: 'Judge not found'
            });
        }

        return res.json({
            ok: true,
            judge: judgeRecord
        });
    } catch (err) {
        console.error('Error fetching authenticated judge:', err);
        return res.status(500).json({
            ok: false,
            message: 'Server error'
        });
    }
});

module.exports = router;