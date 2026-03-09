function buildPasswordResetEmailTemplate({ recipientLanguage, accountLabel, resetLink }) {

    const templateByLanguage = {
        EN: {
            emailSubject: 'IAMOOT Password Reset',
            emailText: [
                'Hello',
                '',
                'A request was received to reset the password for the IAMMOT account associated with:',
                accountLabel,
                '',
                'If you made this request you can set a new password using the link below:',
                resetLink,
                '',
                'If you did not request a password reset, you can safely ifnore this email.',
                '',
                'IAMOOT Support',
                'iamootsupport@iamootofficial.org'
            ].join('\n'),
            emailHtml: `
                <p>Hello,</p>
                <p>A request was received to reset the password for the IAMOOT account associated with:</p>
                <p><strong>${accountLabel}</strong></p>
                <p>If you made this request, you can set a new password using the link below:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>If you did not request a password reset, you can safely ignore this email.</p>
                <p>IAMOOT Support<br />iamootsupport@iamootofficial.org</p> 
            `
        },
        ES: {
            emailSubject: 'IAMOOT Restablecimiento de Contraseña',
            emailText: [
                'Hola,',
                '',
                'Se recibió una solicitud para restablecer la contraseña de la cuenta de IAMOOT asociada con:',
                accountLabel,
                '',
                'Si usted realizó esta solicitud, puede establecer una nueva contraseña utilizando el siguiente enlace:',
                resetLink,
                '',
                'Si usted no solicitó el restablecimiento de contraseña, puede ignorar este correo.',
                '',
                'Soporte IAMOOT',
                'iamootsupport@iamootofficial.org'
            ].join('\n'),
            emailHtml: `
                <p>Hola,</p>
                <p>Se recibió una solicitud para restablecer la contraseña de la cuenta de IAMOOT asociada con:</p>
                <p><strong>${accountLabel}</strong></p>
                <p>Si usted realizó esta solicitud, puede establecer una nueva contraseña utilizando el siguiente enlace:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Si usted no solicitó el restablecimiento de contraseña, puede ignorar este correo.</p>
                <p>Soporte IAMOOT<br />iamootsupport@iamootofficial.org</p>
            `,
        },
        POR: {
            emailSubject: 'IAMOOT Redefinição de Senha',
            emailText: [
                'Olá,',
                '',
                'Recebemos uma solicitação para redefinir a senha da conta do IAMOOT associada a:',
                accountLabel,
                '',
                'Se você fez essa solicitação, pode definir uma nova senha usando o link abaixo:',
                resetLink,
                '',
                'Se você não solicitou essa redefinição, pode ignorar este e-mail.',
                '',
                'Suporte IAMOOT',
                'iamootsupport@iamootofficial.org',
            ].join('\n'),
            emailHtml: `
                <p>Olá,</p>
                <p>Recebemos uma solicitação para redefinir a senha da conta do IAMOOT associada a:</p>
                <p><strong>${accountLabel}</strong></p>
                <p>Se você fez essa solicitação, pode definir uma nova senha usando o link abaixo:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p>Se você não solicitou essa redefinição, pode ignorar este e-mail.</p>
                <p>Suporte IAMOOT<br />iamootsupport@iamootofficial.org</p>
            `,
        }
    }

    return templateByLanguage[recipientLanguage] || templateByLanguage.EN;

}

module.exports = {
    buildPasswordResetEmailTemplate,
}