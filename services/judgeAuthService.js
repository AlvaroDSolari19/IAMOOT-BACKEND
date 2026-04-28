const { getCollection } = require('../db'); 

const crypto = require('crypto'); 
const bcrypt = require('bcryptjs'); 
const jsonWebToken = require('jsonwebtoken'); 

const { sendEmail } = require('../services/emailService'); 
const { buildPasswordResetEmailTemplate } = require('../services/emailTemplates');

/*********
 * LOGIN *
 *********/
async function loginJudge (req, res, {collectionName }) {

    try {

        const { email, password } = req.body; 
        if (!email || !password) return res.status(400).json({ ok: false });

        const emailNorm = String(email).trim().toLowerCase(); 
        const passwordString = String(password); 

        const judgesCollection = getCollection(collectionName); 
        const judgeRecord = await judgesCollection.findOne({ primaryEmail: emailNorm });
        if (!judgeRecord || !judgeRecord.passwordHash) return res.status(400).json({ ok: false }); 

        const passwordMatch = await bcrypt.compare(passwordString, judgeRecord.passwordHash); 
        if (!passwordMatch) return res.status(400).json({ ok: false });

        const tokenSecretKey = process.env.JWT_SECRET; 
        if (!tokenSecretKey) return res.status(500).json({ ok: false });

        const authToken = jsonWebToken.sign(
            { judgeID: judgeRecord.judgeID },
            tokenSecretKey, 
            { expiresIn: '2h' }
        );

        return res.json({ ok: true, token: authToken });

    } catch (err){
        return res.status(500).json({ ok: false });
    }

} 

/*****************************
 * REQUEST SET PASSWORD LINK *
 *****************************/
async function requestJudgePassword (req, res, {collectionName}) {

    const genericSuccess = { ok: true };

    try {

        const { email } = req.body; 
        if (!email) return res.json(genericSuccess); 
        const emailNorm = String(email).trim().toLowerCase(); 

        const judgesCollection = getCollection(collectionName); 
        const judgeRecord = await judgesCollection.findOne({ primaryEmail: emailNorm });
        if (!judgeRecord) return res.json(genericSuccess); 

        const rawToken = crypto.randomBytes(32).toString('hex'); 
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex'); 
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); 

        await judgesCollection.updateOne(
            { _id: judgeRecord._id },
            {
                $set: {
                    resetTokenHash: tokenHash, 
                    resetTokenExpiresAt: expiresAt, 
                    resetTokenCreatedAt: new Date()
                }
            }
        );

        const frontendBaseURL = process.env.FRONTEND_WRITTEN_JUDGES_URL; 
        if (!frontendBaseURL) throw new Error('Missing FRONTEND_BASE_URL environment variable'); 

        const resetLink = `${frontendBaseURL}/set-password?email=${encodeURIComponent(emailNorm)}&token=${rawToken}`;

        const emailTemplate = buildPasswordResetEmailTemplate({
            recipientLanguage: judgeRecord.currentLanguage, 
            accountLabel: judgeRecord.fullName || `Judge ${judgeRecord.judgeID}`,
            resetLink
        });

        await sendEmail({
            recipientEmail: emailNorm, 
            emailSubject: emailTemplate.emailSubject, 
            emailText: emailTemplate.emailText, 
            emailHtml: emailTemplate.emailHtml
        });

        return res.json(genericSuccess);

    } catch (err){
        console.error('REQUEST JUDGE PASSWORD ERROR: ', err); 
        return res.json(genericSuccess); 
    }

}

/****************
 * SET PASSWORD * 
 ****************/
async function setJudgePassword (req, res, {collectionName}) {

    try {

        const { email, resetToken, newPassword } = req.body;
        if (!email || !resetToken || !newPassword) return res.status(400).json({ ok: false });

        const emailNorm = String(email).trim().toLowerCase(); 
        const tokenString = String(resetToken).trim(); 

        const judgesCollection = getCollection(collectionName); 
        const judgeRecord = await judgesCollection.findOne({ primaryEmail: emailNorm });
        if (!judgeRecord) return res.status(400).json({ ok: false });
        if (!judgeRecord.resetTokenHash || !judgeRecord.resetTokenExpiresAt) return res.status(400).json({ ok: false });

        const expiresTime = new Date(judgeRecord.resetTokenExpiresAt).getTime(); 
        if (Number.isNaN(expiresTime) || Date.now() > expiresTime) return res.status(400).json({ ok: false });

        const incomingHash = crypto.createHash('sha256').update(tokenString).digest('hex');
        if (incomingHash !== judgeRecord.resetTokenHash) return res.status(400).json({ ok: false });

        const saltRounds = 12; 
        const passwordHash = await bcrypt.hash(newPassword, saltRounds); 

        await judgesCollection.updateOne(
            { _id: judgeRecord._id },
            { 
                $set: {
                    passwordHash: passwordHash
                },
                $unset: {
                    resetTokenHash: '', 
                    resetTokenExpiresAt: '', 
                    resetTokenCreatedAt: ''
                }
            }
        );

        return res.json({ ok: true });

    } catch (err) {
        return res.status(500).json({ ok: false });
    }

}

module.exports = {
    loginJudge, 
    requestJudgePassword, 
    setJudgePassword
};