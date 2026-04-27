const express = require('express');
const router = express.Router();
const { getCollection } = require('../db');

const requireJudgeAuth = require('../middleware/requireJudgeAuth');

const SCORE_LIMITS = [25, 15, 40, 5, 5, 10];

/**********************************************
 * OLD / TEST ROUTE: GET SCORE BY JUDGE ID
 **********************************************/
router.get('/written-memoranda/:memorandumID/scores/:judgeID', async (req, res) => {
    const memorandumID = String(req.params.memorandumID || '').trim().toUpperCase();
    const judgeID = Number(req.params.judgeID);

    if (!memorandumID || Number.isNaN(judgeID)) {
        return res.status(400).json({
            ok: false,
            message: 'Invalid memorandumID or judgeID'
        });
    }

    try {
        const memorandaCollection = getCollection('memoranda');

        const memorandumDoc = await memorandaCollection.findOne({ memorandumID });

        if (!memorandumDoc) {
            return res.status(404).json({
                ok: false,
                message: 'Memorandum not found'
            });
        }

        const existingSubmission = (memorandumDoc.scoresByJudge || []).find(
            (scoreEntry) => Number(scoreEntry.judgeID) === judgeID
        );

        if (!existingSubmission) {
            return res.status(200).json({
                ok: true,
                hasSubmission: false
            });
        }

        return res.status(200).json({
            ok: true,
            hasSubmission: true,
            memorandumID: memorandumDoc.memorandumID,
            judgeID: existingSubmission.judgeID,
            submittedScores: existingSubmission.submittedScores,
            totalScore: existingSubmission.totalScore,
            submittedAt: existingSubmission.submittedAt
        });
    } catch (error) {
        console.error('ERROR FETCHING WRITTEN SCORES:', error);
        return res.status(500).json({
            ok: false,
            message: 'Server error while fetching scores for this memorandum'
        });
    }
});

/**********************************************
 * OLD / TEST ROUTE: SUBMIT SCORE BY JUDGE ID
 **********************************************/
router.post('/written-memoranda/:memorandumID/scores', async (req, res) => {
    const memorandumID = String(req.params.memorandumID || '').trim().toUpperCase();
    const { judgeID, submittedScores } = req.body;

    const numericJudgeID = Number(judgeID);

    if (!memorandumID || Number.isNaN(numericJudgeID) || !Array.isArray(submittedScores)) {
        return res.status(400).json({
            ok: false,
            message: 'Missing or invalid required fields'
        });
    }

    if (submittedScores.length !== SCORE_LIMITS.length) {
        return res.status(400).json({
            ok: false,
            message: `Expected ${SCORE_LIMITS.length} scores`
        });
    }

    for (let i = 0; i < submittedScores.length; i++) {
        const currentScore = Number(submittedScores[i]);
        const currentMax = SCORE_LIMITS[i];

        if (Number.isNaN(currentScore)) {
            return res.status(400).json({
                ok: false,
                message: `Score at index ${i} must be a number`
            });
        }

        if (currentScore < 0 || currentScore > currentMax) {
            return res.status(400).json({
                ok: false,
                message: `Score at index ${i} must be between 0 and ${currentMax}`
            });
        }
    }

    try {
        const memorandaCollection = getCollection('memoranda');

        const memorandumDoc = await memorandaCollection.findOne({ memorandumID });

        if (!memorandumDoc) {
            return res.status(404).json({
                ok: false,
                message: 'Memorandum not found'
            });
        }

        const existingSubmission = (memorandumDoc.scoresByJudge || []).find(
            (scoreEntry) => Number(scoreEntry.judgeID) === numericJudgeID
        );

        if (existingSubmission) {
            return res.status(403).json({
                ok: false,
                message: 'Scores for this memorandum have already been submitted by this judge'
            });
        }

        const normalizedScores = submittedScores.map((score) => Number(score));
        const totalScore = normalizedScores.reduce((sum, currentScore) => sum + currentScore, 0);

        const newScoreEntry = {
            judgeID: numericJudgeID,
            submittedScores: normalizedScores,
            totalScore,
            submittedAt: new Date(),
            locked: true
        };

        const updateResult = await memorandaCollection.updateOne(
            {
                memorandumID,
                'scoresByJudge.judgeID': { $ne: numericJudgeID }
            },
            {
                $push: { scoresByJudge: newScoreEntry },
                $set: { updatedAt: new Date() }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(403).json({
                ok: false,
                message: 'Scores for this memorandum have already been submitted by this judge'
            });
        }

        return res.status(201).json({
            ok: true,
            message: 'Written scores submitted successfully',
            memorandumID,
            judgeID: numericJudgeID,
            submittedScores: normalizedScores,
            totalScore
        });
    } catch (error) {
        console.error('ERROR SUBMITTING WRITTEN SCORES:', error);
        return res.status(500).json({
            ok: false,
            message: 'Server error while submitting written scores'
        });
    }
});

/**********************************************
 * CURRENT ROUTE: GET LOGGED-IN JUDGE SCORE
 **********************************************/
router.get('/written-memoranda/:memorandumID/my-score', requireJudgeAuth, async (req, res) => {
    const memorandumID = String(req.params.memorandumID || '').trim().toUpperCase();
    const judgeID = Number(req.authJudgeID);

    if (!memorandumID || Number.isNaN(judgeID)) {
        return res.status(400).json({
            ok: false,
            message: 'Invalid memorandumID or judgeID'
        });
    }

    try {
        const memorandaCollection = getCollection('memoranda');

        const memorandumDoc = await memorandaCollection.findOne({ memorandumID });

        if (!memorandumDoc) {
            return res.status(404).json({
                ok: false,
                message: 'Memorandum not found'
            });
        }

        const existingSubmission = (memorandumDoc.scoresByJudge || []).find(
            (scoreEntry) => Number(scoreEntry.judgeID) === judgeID
        );

        if (!existingSubmission) {
            return res.status(200).json({
                ok: true,
                hasSubmission: false
            });
        }

        return res.status(200).json({
            ok: true,
            hasSubmission: true,
            memorandumID: memorandumDoc.memorandumID,
            judgeID: existingSubmission.judgeID,
            submittedScores: existingSubmission.submittedScores,
            totalScore: existingSubmission.totalScore,
            submittedAt: existingSubmission.submittedAt
        });
    } catch (error) {
        console.error('ERROR FETCHING WRITTEN SCORES:', error);
        return res.status(500).json({
            ok: false,
            message: 'Server error while fetching scores for this memorandum'
        });
    }
});

/**********************************************
 * CURRENT ROUTE: SUBMIT LOGGED-IN JUDGE SCORE
 **********************************************/
router.post('/written-memoranda/:memorandumID/my-score', requireJudgeAuth, async (req, res) => {
    const memorandumID = String(req.params.memorandumID || '').trim().toUpperCase();
    const judgeID = Number(req.authJudgeID);
    const { submittedScores } = req.body;

    if (!memorandumID || Number.isNaN(judgeID) || !Array.isArray(submittedScores)) {
        return res.status(400).json({
            ok: false,
            message: 'Missing or invalid required fields'
        });
    }

    if (submittedScores.length !== SCORE_LIMITS.length) {
        return res.status(400).json({
            ok: false,
            message: `Expected ${SCORE_LIMITS.length} scores`
        });
    }

    for (let i = 0; i < submittedScores.length; i++) {
        const currentScore = Number(submittedScores[i]);
        const currentMax = SCORE_LIMITS[i];

        if (Number.isNaN(currentScore)) {
            return res.status(400).json({
                ok: false,
                message: `Score at index ${i} must be a number`
            });
        }

        if (currentScore < 0 || currentScore > currentMax) {
            return res.status(400).json({
                ok: false,
                message: `Score at index ${i} must be between 0 and ${currentMax}`
            });
        }
    }

    try {
        const memorandaCollection = getCollection('memoranda');

        const memorandumDoc = await memorandaCollection.findOne({ memorandumID });

        if (!memorandumDoc) {
            return res.status(404).json({
                ok: false,
                message: 'Memorandum not found'
            });
        }

        const existingSubmission = (memorandumDoc.scoresByJudge || []).find(
            (scoreEntry) => Number(scoreEntry.judgeID) === judgeID
        );

        if (existingSubmission) {
            return res.status(403).json({
                ok: false,
                message: 'Scores for this memorandum have already been submitted by this judge'
            });
        }

        const normalizedScores = submittedScores.map((score) => Number(score));
        const totalScore = normalizedScores.reduce((sum, currentScore) => sum + currentScore, 0);

        const newScoreEntry = {
            judgeID,
            submittedScores: normalizedScores,
            totalScore,
            submittedAt: new Date(),
            locked: true
        };

        const updateResult = await memorandaCollection.updateOne(
            {
                memorandumID,
                'scoresByJudge.judgeID': { $ne: judgeID }
            },
            {
                $push: { scoresByJudge: newScoreEntry },
                $set: { updatedAt: new Date() }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(403).json({
                ok: false,
                message: 'Scores for this memorandum have already been submitted by this judge'
            });
        }

        return res.status(201).json({
            ok: true,
            message: 'Written scores submitted successfully',
            memorandumID,
            judgeID,
            submittedScores: normalizedScores,
            totalScore
        });
    } catch (error) {
        console.error('ERROR SUBMITTING WRITTEN SCORES:', error);
        return res.status(500).json({
            ok: false,
            message: 'Server error while submitting written scores'
        });
    }
});

module.exports = router;