const express = require('express'); 
const { getCollection } = require('../db'); 

const router = express.Router(); 

/***********************
 * PRELIMINARY MATCHES *
 ***********************/
router.get('/admin/oral/preliminary-matches', async (req, res) => {

    try {

        const preliminaryMatchesCollection = getCollection('preliminaryMatches'); 

        const preliminaryMatches = await preliminaryMatchesCollection.find({}).project({
            _id: 0, 
            matchID: 1, 
            stateTeam: 1, 
            victimTeam: 1, 
            stateTeamUniversity: 1, 
            victimTeamUniversity: 1, 
            matchDay: 1, 
            matchDate: 1, 
            matchTime: 1, 
            roomNumber: 1, 
            winningTeam: 1
        }).toArray();

        preliminaryMatches.sort((firstMatch, secondMatch) => {
            const firstMatchDateTime = new Date(`${firstMatch.matchDate} ${firstMatch.matchTime}`);
            const secondMatchDateTime = new Date(`${secondMatch.matchDate} ${secondMatch.matchTime}`);
            return firstMatchDateTime - secondMatchDateTime; 
        })

        return res.status(200).json({
            ok: true, 
            message: 'Preliminary matches retrieved successfully.',
            preliminaryMatches
        });

    } catch (error){
        console.error('Preliminary matches error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve preliminary matches.'}); 
    }
});

/*****************************
 * PRELIMINARY MATCH DETAILS *
 *****************************/
router.get('/admin/oral/preliminary-match/:matchID', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim(); 
        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches'); 
        
        const matchRecord = await preliminaryMatchesCollection.findOne(
            { matchID }, 
            {
                projection: {
                    _id: 0, 
                    matchID: 1, 
                    stateTeam: 1, 
                    victimTeam: 1, 
                    stateTeamUniversity: 1, 
                    victimTeamUniversity: 1, 
                    matchDay: 1, 
                    matchTime: 1, 
                    roomNumber: 1, 
                    assignedJudges: 1, 
                    winningTeam: 1
                }
            }
        );

        if (!matchRecord) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        return res.status(200).json({
            ok: true, 
            message: 'Preliminary match details retrieved successfully.', 
            match: matchRecord
        });

    } catch (error) {
        console.error('Preliminary match details error: ', error);
        return res.status(500).json({ ok: false, message: 'Failed to retrieve preliminary match details.'});
    }

});

/**********************
 * SEARCH ORAL JUDGES *
 **********************/
router.get('/admin/oral/judges', async (req, res) => {

    try{

        const judgeSearchValue = String(req.query.judgeID || '').trim(); 
        
        const preliminaryJudgesCollection = getCollection('preliminaryJudges'); 
        const judgeQuery = judgeSearchValue ? { $expr: { $regexMatch: { input: { $toString: '$judgeID' }, regex: `^${judgeSearchValue}` } } } : {}; 

        const matchingJudges = await preliminaryJudgesCollection.find(judgeQuery).project({
            _id: 0, 
            judgeID: 1, 
            fullName: 1
        }).sort({
            judgeID: 1
        }).toArray(); 

        return res.status(200).json({
            ok: true, 
            message: 'Oral judges retrieved successfully.', 
            matchingJudges
        });

    } catch (error) {
        console.error('Oral judges search error: ', error); 
        return res.status(500).json({ ok: false, message: 'Failed to retrieve oral judges.' });
    }

});

/*************************
 * ADD PRELIMINARY JUDGE *
 *************************/
router.patch('/admin/oral/preliminary-match/:matchID/judges', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim();
        const judgeID = Number(req.body.judgeID); 

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (Number.isNaN(judgeID)) return res.status(400).json({ ok: false, message: 'Judge ID is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');
        const preliminaryJudgesCollection = getCollection('preliminaryJudges'); 

        const judgeRecord = await preliminaryJudgesCollection.findOne(
            { judgeID }, 
            { 
                projection: {
                    _id: 0, 
                    judgeID: 1, 
                    fullName: 1
                }
            }
        );

        if (!judgeRecord) return res.status(404).json({ ok: false, message: 'Judge was not found.' });

        const assignedJudge = {
            judgeID: judgeRecord.judgeID, 
            judgeName: judgeRecord.fullName
        };

        await preliminaryMatchesCollection.updateOne(
            { matchID }, 
            {
                $push: {
                    assignedJudges: assignedJudge
                }
            }
        );

        return res.status(200).json({
            ok: true, 
            message: 'Judge added successfully.'
        })

    } catch (error) {
        console.error('Add preliminary judge error: ', error); 
        return res.status(500).json({ ok: false, message: 'Failed to add judge.' }); 
    }

});

/****************************
 * REMOVE PRELIMINARY JUDGE *
 ****************************/
router.patch('/admin/oral/preliminary-match/:matchID/judges/remove', async (req, res) => {

    try {

        const matchID = String(req.params.matchID || '').trim(); 
        const judgeID = Number(req.body.judgeID); 

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' }); 
        if (Number.isNaN(judgeID)) return res.status(400).json({ ok: false, message: 'Judge ID is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches'); 

        const updateResult = await preliminaryMatchesCollection.updateOne(
            { matchID }, 
            {
                $pull: {
                    assignedJudges: { judgeID }
                }
            }
        ); 

        if (updateResult.matchedCount === 0) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        return res.status(200).json({
            ok: true, 
            message: 'Judge removed successfully.'
        });

    } catch (error) {
        console.error('Remove preliminary judge error: ', error); 
        return res.status(500).json({ ok: false, message: 'Failed to remove judge.' });
    }

});

/***********************
 * UPDATE WINNING TEAM *
 ***********************/
router.patch('/admin/oral/preliminary-match/:matchID/winner', async (req, res) => {

    try {
        const matchID = String(req.params.matchID || '').trim(); 
        const winningTeam = String(req.body.winningTeam || '').trim(); 

        if (!matchID) return res.status(400).json({ ok: false, message: 'Match ID is required.' });
        if (!winningTeam) return res.status(400).json({ ok: false, message: 'Winning team is required.' });

        const preliminaryMatchesCollection = getCollection('preliminaryMatches');

        const matchRecord = await preliminaryMatchesCollection.findOne(
            { matchID }, 
            {
                projection: {
                    _id: 0, 
                    stateTeam: 1, 
                    victimTeam: 1
                }
            }
        );

        if (!matchRecord) return res.status(404).json({ ok: false, message: 'Preliminary match was not found.' });

        const validWinningTeams = [matchRecord.stateTeam, matchRecord.victimTeam]; 
        if (!validWinningTeams.includes(winningTeam)) return res.status(400).json({ ok: false, message: 'Winning team must belong to this match.' });
        
        await preliminaryMatchesCollection.updateOne(
            { matchID },
            {
                $set: {
                    winningTeam
                }
            }
        );

        return res.status(200).json({
            ok: true, 
            message: 'Winning team updated successfully.'
        });

    } catch (error){
        console.error('Preliminary match winner update error: ', error); 
        return res.status(500).json({ ok: false, message: 'Failed to update winning team.' });
    }

});

/***********************
 * PRELIMINARY RESULTS *
 ***********************/


module.exports = router; 