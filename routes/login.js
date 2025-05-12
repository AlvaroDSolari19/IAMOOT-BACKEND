const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require('../db'); 

router.post('/login', async (req, res) => {

    const { userEmail, userPass } = req.body;

    try {
        
        const judgesCollection = getCollection('judges'); 

        /* Search for currentJudge by userEmail while case insensitive by using a regex expression. */
        const currentJudge = await judgesCollection.findOne({
            primaryEmail: { $regex: `^${userEmail}$`, $options: 'i' }
        });

        /* If the currentJudge was not found by the email provided, return an error code of 401. */
        if (!currentJudge) { 
            return res.status(401).json({ message: 'Invalid email' });
        }

        /* If currentJudge.currentPassword does not match what was in the req.body.userPass, then return an error code of 401. */
        if (currentJudge.currentPassword !== userPass){
            return res.status(401).json({ message: 'Invalid password' });
        }

        res.json({
            currentName: currentJudge.fullName, 
            currentRole: currentJudge.currentRole,  
        })


    } catch (err) {
        console.error('Login error:', err); 
        res.status(500).json({ message: 'Server error' });
    }

});

module.exports = router; 