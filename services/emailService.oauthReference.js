/*
This file contains the original OAuth2 + refresh token implementation that was
tested for sending email through Gmail using Nodemailer.

The OAuth authorization flow itself worked correctly and Google successfully
issued a refresh token for the IAMOOT support mailbox. The backend was also
able to generate access tokens from the refresh token without any errors.

However, the SMTP authentication step used by Nodemailer failed during the
AUTH XOAUTH2 handshake with the error "535-5.7.8 Username and Password not
accepted".

Because the priority for this year's competition is having a reliable email
system, the production implementation currently uses a Google App Password
instead of OAuth2. The App Password approach works correctly with Nodemailer
and requires significantly less configuration for this project.

This file is intentionally kept as a reference in case the project later
returns to an OAuth-based implementation. Google App Passwords are not the
preferred long-term method for automated email and they could eventually be
restricted or removed.

If that happens, the recommended direction would be either fixing the
Nodemailer SMTP OAuth configuration or migrating the email service to use the
Gmail API directly instead of SMTP.
*/

const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const senderEmail = process.env.GOOGLE_SENDER_EMAIL;

if (!clientID || !clientSecret || !refreshToken || !senderEmail) {
    throw new Error('Missing Google email environment variables.');
}

const oauth2Client = new google.auth.OAuth2(
    clientID,
    clientSecret,
    'http://localhost'
);

oauth2Client.setCredentials({
    refresh_token: refreshToken
});

async function sendEmailWithOAuth ({ recipientEmail, emailSubject, emailText, emailHtml }) {
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse?.token;

    if (!accessToken) {
        throw new Error('Unable to generate Google access token');
    }

    const emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: senderEmail,
            clientId: clientID,
            clientSecret,
            refreshToken,
            accessToken
        }
    });

    const mailOptions = {
        from: senderEmail, 
        to: recipientEmail, 
        subject: emailSubject, 
        text: emailText
    };

    if (emailHtml) {
        mailOptions.html = emailHtml;
    }

    const sendResult = await emailTransporter.sendMail(mailOptions);
    return sendResult;

}

module.exports = {
    sendEmailWithOAuth
};