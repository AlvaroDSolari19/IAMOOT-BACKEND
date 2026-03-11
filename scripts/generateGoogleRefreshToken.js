require('dotenv').config();

const { google } = require('googleapis'); 
const readline = require('readline'); 

const clientID = process.env.GOOGLE_CLIENT_ID; 
const clientSecret = process.env.GOOGLE_CLIENT_SECRET; 

if (!clientID || !clientSecret){
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env'); 
    process.exit(1); 
}

const oauth2Client = new google.auth.OAuth2(
    clientID, 
    clientSecret, 
    'http://localhost'
);

const googleScopes = [
    'https://www.googleapis.com/auth/gmail.send'
];

const authURL = oauth2Client.generateAuthUrl({
    access_type: 'offline', 
    prompt: 'consent', 
    scope: googleScopes
});

console.log(`Open this URL in your browser: ${authURL}`); 
console.log(); 

const terminalReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
}); 

terminalReader.question('Paste the code here: ', async (authCode) => {
    try {

        const tokenResponse = await oauth2Client.getToken(authCode); 
        const tokenData = tokenResponse.tokens; 

        console.log(); 
        console.log(`Access Token: ${tokenData.access_token}`);
        console.log(`Refresh Token: ${tokenData.refresh_token}`);
        terminalReader.close(); 

    } catch (tokenError){
        console.error(`Error getting tokens: ${tokenError.message}`);
        terminalReader.close();
    }
});