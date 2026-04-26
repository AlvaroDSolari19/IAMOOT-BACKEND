const jsonWebToken = require('jsonwebtoken'); 

/* Protects judge-only routes by verifitying a JWT from the Authorization header. 
 * If valid, attached req.authJudgeID to the request; otherwise returns 401. */
function requireJudgeAuth (req, res, next){

    try { 
        const authHeader = req.headers.authorization || ''; 

        const hasBearerPrefix = authHeader.startsWith('Bearer '); 
        if (!hasBearerPrefix) return res.status(401).json({ ok: false });

        const tokenValue = authHeader.slice('Bearer '.length);

        const tokenSecretKey = process.env.JWT_SECRET; 
        if (!tokenSecretKey) return res.status(500).json({ ok: false });

        const decodedToken = jsonWebToken.verify(tokenValue, tokenSecretKey); 
        req.authJudgeID = decodedToken.judgeID; 

        return next(); 

    } catch (authError){
        return res.status(401).json({ ok: false });
    }

} 

module.exports = requireJudgeAuth; 