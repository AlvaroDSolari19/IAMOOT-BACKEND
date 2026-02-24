const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require ('../db');
const crypto = require('crypto'); 
const bcrypt = require('bcryptjs'); 

/*****************************
 * REQUEST SET PASSWORD LINK *
 *****************************/ 
router.post('/participants/request-password', async (req, res) => {

    const genericSuccess = { ok: true };

    try {
        
        const { teamID, requestEmail } = req.body; 
        console.log(req.body);
        if (!teamID || !requestEmail) return res.json(genericSuccess); 

        const teamIDString = String(teamID).trim();
        const emailNorm = String(requestEmail).trim().toLowerCase(); 

        const writtenTeams = getCollection('writtenTeams'); 
        const teamRecord = await writtenTeams.findOne({ teamID: teamIDString });
        console.log()
        if (!teamRecord) return res.json(genericSuccess); 

        const emailList = Array.isArray(teamRecord.participantEmails) ? teamRecord.participantEmails : []; 
        const emailMatch = emailList.map(e => String(e).trim().toLowerCase()).includes(emailNorm); 
        if (!emailMatch) return res.json(genericSuccess); 

        const rawToken = crypto.randomBytes(32).toString('hex'); 
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex'); 
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); 

        await writtenTeams.updateOne(
            {_id: teamRecord._id }, 
            {
                $set: {
                    resetTokenHash: tokenHash, 
                    resetTokenExpiresAt: expiresAt, 
                    resetTokenCreatedAt: new Date()
                }
            }
        );

        console.log(`PASSWORD RESET LINK: http://localhost:5173/set-password?teamID=${encodeURIComponent(teamIDString)}&token=${rawToken}`);
        return res.json(genericSuccess); 

    } catch (err) {
        return res.json(genericSuccess);
    }
});

module.exports = router; 