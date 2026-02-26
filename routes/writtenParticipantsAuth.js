const express = require('express'); 
const router = express.Router(); 
const { getCollection } = require ('../db');

const crypto = require('crypto'); 
const bcrypt = require('bcryptjs'); 
const jsonWebToken = require('jsonwebtoken'); 

const requireTeamAuth = require('../middleware/requireTeamAuth');

router.get('/participants/auth-check', requireTeamAuth, (req,res) => {
    return res.json({ ok: true, teamID: req.authTeamID });
})

/*********
 * LOGIN * 
 *********/
router.post('/participants/login', async (req, res) => {
    
    try {
        
        const { teamID, teamPassword } = req.body; 
        if (!teamID || !teamPassword) return res.status(400).json({ ok: false }); 

        const teamIDString = String(teamID).trim(); 
        const passwordString = String(teamPassword); 

        const writtenTeams = getCollection('writtenTeams');
        const teamRecord = await writtenTeams.findOne({ teamID: teamIDString });
        if (!teamRecord) return res.status(400).json({ ok: false }); 
        if (!teamRecord.passwordHash) return res.status(400).json({ ok: false }); 

        const passwordMatch = await bcrypt.compare(passwordString, teamRecord.passwordHash);
        if (!passwordMatch) return res.status(400).json({ ok: false });

        const tokenSecretKey = process.env.JWT_SECRET;
        if (!tokenSecretKey) return res.status(500).json({ ok: false });

        const authToken = jsonWebToken.sign(
            { teamID: teamRecord.teamID }, 
            tokenSecretKey, 
            { expiresIn: '2h' }
        );
        
        return res.json({ ok: true, token: authToken }); 
    } catch (err) {
        return res.status(500).json({ ok: false });
    }

});

/*****************************
 * REQUEST SET PASSWORD LINK *
 *****************************/ 
router.post('/participants/request-password', async (req, res) => {

    const genericSuccess = { ok: true };

    try {
        
        const { teamID, requestEmail } = req.body; 
        if (!teamID || !requestEmail) return res.json(genericSuccess); 

        const teamIDString = String(teamID).trim();
        const emailNorm = String(requestEmail).trim().toLowerCase(); 

        const writtenTeams = getCollection('writtenTeams'); 
        const teamRecord = await writtenTeams.findOne({ teamID: teamIDString });
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

/****************
 * SET PASSWORD *
 ****************/
router.post('/participants/set-password', async (req, res) => {

    try {
        const { teamID, resetToken, newPassword } = req.body; 
        if (!teamID || !resetToken || !newPassword) return res.status(400).json({ ok: false });

        const teamIDString = String(teamID).trim(); 
        const tokenString = String(resetToken).trim(); 

        const writtenTeams = getCollection('writtenTeams'); 
        const teamRecord = await writtenTeams.findOne({ teamID: teamIDString});
        if (!teamRecord) return res.status(400).json({ ok: false }); 
        if (!teamRecord.resetTokenHash || !teamRecord.resetTokenExpiresAt) return res.status(400).json({ ok: false });

        const expiresTime = new Date(teamRecord.resetTokenExpiresAt).getTime();
        if (Number.isNaN(expiresTime) || Date.now() > expiresTime) return res.status(400).json({ ok: false });

        /* Reset tokens are verified using SHA-256 because it is deterministic. 
         * We hash the incoming token and compare it to the stored hash value. */
        const incomingHash = crypto.createHash('sha256').update(tokenString).digest('hex'); 
        if (incomingHash !== teamRecord.resetTokenHash) return res.status(400).json({ ok: false });

        /* Passwords are stored using bcrypt which generates a random salt internally. 
         * bcrypt hashes are different each time and bcrypt.compare() handles verification. */ 
        const saltRounds = 12; 
        const passwordHash = await bcrypt.hash(newPassword, saltRounds); 

        await writtenTeams.updateOne(
            { _id: teamRecord._id },
            {
                $set: { passwordHash: passwordHash }, 
                $unset: {
                    resetTokenHash: '', 
                    resetTokenExpiresAt: '', 
                    resetTokenCreatedAt: ''
                }
            }
        );

        return res.json({ ok: true });

    } catch (err){
        return res.status(500).json({ ok: false });
    }

});

module.exports = router; 