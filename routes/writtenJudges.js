const express = require('express'); 
const router = express.Router(); 

const {
    loginJudge, 
    requestJudgePassword, 
    setJudgePassword
} = require('../services/judgeAuthService'); 

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

module.exports = router; 