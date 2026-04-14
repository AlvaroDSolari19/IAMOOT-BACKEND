const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db'); 

router.post('/loginWritten', async (req, res) => {

    const { userEmail, userPass } = req.body;
    try {
        const judgesCollection = getCollection('writtenJudges'); 

        //Delete later
        console.log('LOGIN WRITTEN ATTEMPT');
        console.log('userEmail received:', userEmail);
        console.log('userPass received:', userPass);

         const normalizedEmail = String(userEmail).trim().toLowerCase();
        console.log('normalizedEmail:', normalizedEmail);

        const totalJudges = await judgesCollection.countDocuments();
        console.log('writtenJudges count:', totalJudges);

        const sampleJudge = await judgesCollection.findOne({});
        console.log('sampleJudge:', sampleJudge);

        /* Search for currentJudge by userEmail while case insensitive by using a regex expression. */
        const currentJudge = await judgesCollection.findOne({
            primaryEmail: normalizedEmail
        });

        console.log('currentJudge found:', currentJudge); //Delete later

        /* If the currentJudge was not found by the email provided, return an error code of 401. */
        if (!currentJudge) { 
            return res.status(401).json({ message: 'Invalid email' });
        }

        console.log('stored password:', currentJudge.currentPassword);


        /* If currentJudge.currentPassword does not match what was in the req.body.userPass, then return an error code of 401. */
        if (String(currentJudge.currentPassword).trim() !== String(userPass).trim()) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        res.json({
            currentID: currentJudge.judgeID, 
            currentName: currentJudge.fullName, 
            currentRole: currentJudge.currentRole,
            currentMemorandums: currentJudge.assignedMemorandums  
        })


    } catch (err) {
        console.error('Login error:', err); 
        res.status(500).json({ message: 'Server error' });
    }

});

module.exports = router;