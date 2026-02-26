const jsonWebToken = require('jsonwebtoken');

/* Protects participant-only routes by verifying a JWT from the Authorization header.
 * If valid, attaches req.authTeamID to the request; otherwise returns 401. */
function requireTeamAuth(req, res, next) {

    try {
        const authHeader = req.headers.authorization || '';

        const hasBearerPrefix = authHeader.startsWith('Bearer ');
        if (!hasBearerPrefix) return res.status(401).json({ ok: false });

        const tokenValue = authHeader.slice('Bearer '.length);

        const tokenSecretKey = process.env.JWT_SECRET;
        if (!tokenSecretKey) return res.status(500).json({ ok: false });

        const decodedToken = jsonWebToken.verify(tokenValue, tokenSecretKey);
        req.authTeamID = decodedToken.teamID; 

        return next(); 

    } catch (authError) {
        return res.status(401).json({ ok: false });
    }
}

module.exports = requireTeamAuth; 