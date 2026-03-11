const { Dropbox } = require('dropbox'); 

async function getDropboxClient() { 
    const appKey = process.env.DROPBOX_APP_KEY; 
    const appSecret = process.env.DROPBOX_APP_SECRET; 
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN; 

    if (!appKey || !appSecret || !refreshToken) { 
        throw new Error ('Missing Dropbox env vars.'); 
    }

    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST', 
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }, 
        body: new URLSearchParams({
            grant_type: 'refresh_token', 
            refresh_token: refreshToken, 
            client_id: appKey, 
            client_secret: appSecret
        }).toString()
    });

    const tokenData = await tokenResponse.json(); 

    if (!tokenResponse.ok){
        throw new Error(`Dropbox token refresh failed: ${JSON.stringify(tokenData)}`);
    }

    const accessToken = tokenData.access_token; 
    return new Dropbox({ accessToken});
}

module.exports = { getDropboxClient };