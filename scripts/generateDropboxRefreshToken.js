require('dotenv').config();

const readline = require('readline');

const appKey = process.env.DROPBOX_APP_KEY;
const appSecret = process.env.DROPBOX_APP_SECRET;

if (!appKey || !appSecret) {
    console.error('Missing DROPBOX_APP_KEY or DROPBOX_APP_SECRET in .env');
    process.exit(1);
}

const authorizationURL = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=code&token_access_type=offline`

console.log(`Open this URL in your browser: ${ authorizationURL } `);
console.log(); 

const terminalReader = readline.createInterface({
    input: process.stdin, 
    output: process.stdout
});

terminalReader.question('Paste the Dropbox code here: ', async (authCode) => {
    try {
        const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code: authCode, 
                grant_type: 'authorization_code', 
                client_id: appKey, 
                client_secret: appSecret
            }).toString()
        });

        const tokenData = await tokenResponse.json(); 

        if (!tokenResponse.ok){
            console.error('Token exchange failed: ', tokenData); 
            terminalReader.close(); 
            return; 
        }

        console.log(); 
        console.log(`Access Token: ${tokenData.access_token}`);
        console.log(`Refresh Token: ${tokenData.refresh_token}`);
        console.log(`Expires In: ${tokenData.expires_in}`); 
        terminalReader.close(); 

    } catch (tokenError) {
        console.error('Error getting tokens: ', tokenError.message);
        terminalReader.close(); 
    }
});