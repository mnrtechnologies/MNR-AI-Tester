exports.passwordUpdated = (email, name) => {
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Password Update Confirmation - MNR AI ClipCut</title>
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
            a {
                color: #007bff;
                text-decoration: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="https://www.mnr-at.com">
                <img class="logo" src="https://res.cloudinary.com/dceqx37jk/image/upload/v1773217190/MNR_AT_egci7h.png" alt="MNR AI Tester Logo">
            </a>
            <div class="title">Password Updated Successfully</div>
            <div class="content">
                <p>Hello <span class="highlight">${name}</span>,</p>
                <p>This is a confirmation that the password for your <span class="highlight">MNR AI Tester</span> account associated with <span class="highlight">${email}</span> has been successfully changed.</p>
                <p>If you did this, you can safely disregard this email. You can now log in using your new password.</p>
                <p style="color: #d9534f; font-weight: bold;">If you did NOT request this change, please contact our security team immediately to secure your account.</p>
            </div>
            <div class="footer">
                <p>If you did not make this change, please contact our <a href="mailto:info@mnrtechnologies.com">support team</a> immediately.</p>
                <p>Have questions? Reach out to us at <a href="mailto:info@mnrtechnologies.com">info@mnrtechnologies.com</a>. We are here to help!</p>
                <br>
                Best Regards,<br>
                <strong>The MNR AI Tester Team</strong>
            </div>
        </div>
    </body>
    </html>`;
};