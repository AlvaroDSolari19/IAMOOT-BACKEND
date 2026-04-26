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
    const judgeID = req.authJudgeID; 

    const judgesCollection = getCollection('writtenJudges'); 
    const judgeRecord = await judgesCollection.findOne({ judgeID });

    return res.json({ ok: true, judge: judgeRecord })
});

module.exports = router; 