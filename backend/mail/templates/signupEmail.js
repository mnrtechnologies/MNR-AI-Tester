exports.signupEmail = (email, name) => {
  return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Account Confirmation - MNR AI Tester</title>
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
            .welcome-title {
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
                background-color: #007bff;
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
            }
            .highlight {
                color: #007bff;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="https://www.mnr-at.com/">
                <img class="logo" src="https://res.cloudinary.com/dceqx37jk/image/upload/v1773217190/MNR_AT_egci7h.png" alt="MNR AI Tester Logo">
            </a>
            <div class="welcome-title">Welcome to MNR AI Tester!</div>
            <div class="content">
                <p>Hello <span class="highlight">${name}</span>,</p>
                <p>Thank you for joining us! We're excited to help you streamline your testing workflow with our AI-powered diagnostic tools.</p>
                <p>Your account is now active under the email: <span class="highlight">${email}</span>.</p>
                <p>To get started, head over to your dashboard and explore our latest features.</p>
            </div>
            <a href="${process.env.FRONTEND_URL}/login" class="cta-button">Login to Your Account</a>
            <div class="footer">
                <p>
                    If you did not create this account, please ignore this email or contact our 
                    <a href="mailto:info@mnrtechnologies.com" style="color: #007bff; text-decoration: none;">support team</a>.
                </p>
                <p>
                    If you have any questions or need further assistance, please feel free to reach out to us at
                    <a href="mailto:info@mnrtechnologies.com" style="color: #007bff; text-decoration: none;">info@mnrtechnologies.com</a>.
                    We are here to help!
                </p>
                <br>
                Best Regards,<br>
                <strong>The MNR AI Tester Team</strong>
            </div>
        </div>
    </body>
    </html>`;
};