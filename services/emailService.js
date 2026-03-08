/*
This service handles sending email from the IAMOOT backend using Nodemailer
and a Google Workspace mailbox.

The current implementation authenticates with Gmail using a Google App
Password associated with the IAMOOT support email account. This approach
was selected because it is simple to configure and works reliably with
Nodemailer for SMTP email delivery.

An OAuth2-based implementation was originally attempted using Google Cloud
credentials and refresh tokens. Although the OAuth flow successfully generated
tokens, the SMTP authentication step failed during the Nodemailer AUTH XOAUTH2 handshake.

Because the immediate priority was having a reliable email system for the
competition, the App Password approach was adopted instead.

If a future migration to OAuth or the Gmail API becomes necessary, the original
OAuth reference implementation can be found in the file: services/emailService.oauthReference.js
*/

const nodemailer = require('nodemailer');

const senderEmail = process.env.GOOGLE_SENDER_EMAIL;
const appPassword = process.env.GOOGLE_APP_PASSWORD;

if (!senderEmail || !appPassword) {
    throw new Error('Missing Google sender email or app password environment variables.');
}

const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: senderEmail,
        pass: appPassword
    }
});

async function sendEmail({ recipientEmail, emailSubject, emailText, emailHtml }) {

    const mailOptions = {
        from: senderEmail,
        to: recipientEmail,
        subject: emailSubject,
        text: emailText
    }

    if (emailHtml) {
        mailOptions.html = emailHtml;
    }

    const sendResult = await emailTransporter.sendMail(mailOptions);
    return sendResult;
}

module.exports = {
    sendEmail
};