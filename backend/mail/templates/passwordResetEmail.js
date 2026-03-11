exports.passwordResetEmail = (url, name) => {
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Password Reset Request - MNR AI Tester</title>
        <style>
            body {
                background-color: #f4f4f4;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-size: 16px;
                line-height: 1.6;
                color: #333333;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                padding: 30px;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.05);
                text-align: center;
            }
            .logo {
                max-width: 180px;
                margin-bottom: 25px;
            }
            .title {
                font-size: 24px;
                font-weight: 700;
                color: #1a1a1a;
                margin-bottom: 15px;
            }
            .content {
                font-size: 16px;
                color: #555555;
                margin-bottom: 25px;
                text-align: left;
            }
            .cta-button {
                display: inline-block;
                padding: 14px 28px;
                background-color: #d9534f;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
            }
            .footer {
                font-size: 13px;
                color: #999999;
                border-top: 1px solid #eeeeee;
                padding-top: 20px;
                margin-top: 20px;
                text-align: center;
            }
            .highlight {
                color: #007bff;
                font-weight: bold;
            }
            .expiry-note {
                font-size: 14px;
                color: #777;
                font-style: italic;
            }
            a {
                color: #007bff;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="https://www.mnr-at.com/">
                <img class="logo" src="https://res.cloudinary.com/dceqx37jk/image/upload/v1773217190/MNR_AT_egci7h.png" alt="MNR AI Tester Logo">
            </a>
            <div class="title">Password Reset Request</div>
            <div class="content">
                <p>Hello <span class="highlight">${name}</span>,</p>
                <p>We received a request to reset the password for your <span class="highlight">MNR AI Tester</span> account.</p>
                <p>Please click the button below to choose a new password. This link is only valid for <span class="highlight">1 hour</span>.</p>
            </div>
            
            <a href="${url}" class="cta-button">Reset My Password</a>
            
            <div class="content">
                <p class="expiry-note">If the button above doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all; font-size: 12px; color: #007bff;">${url}</p>
            </div>

            <div class="footer">
                <p>If you did not request a password reset, please ignore this email or contact our <a href="mailto:info@mnrtechnologies.com">support team</a> if you have concerns.</p>
                <p>Reach out to us at <a href="mailto:info@mnrtechnologies.com">info@mnrtechnologies.com</a>. We are here to help!</p>
                <br>
                Best Regards,<br>
                <strong>The MNR AI Tester Team</strong>
            </div>
        </div>
    </body>
    </html>`;
};