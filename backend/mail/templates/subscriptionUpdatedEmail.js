exports.subscriptionUpdatedEmail = (email, name, planName, days) => {
  return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Subscription Updated - MNR AI Tester</title>
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
                background-color: #f97316;
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
                color: #f97316;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="https://www.mnr-at.com/">
                <img class="logo" src="https://res.cloudinary.com/dceqx37jk/image/upload/v1773217190/MNR_AT_egci7h.png" alt="MNR AI Tester Logo">
            </a>
            <div class="title">Subscription Successfully Updated</div>
            <div class="content">
                <p>Hello <span class="highlight">${name}</span>,</p>
                <p>This email is to confirm that your subscription to MNR AI Tester has been successfully updated.</p>
                <p>You are now subscribed to the <span class="highlight">${planName}</span>, and your new plan will be active for the next <span class="highlight">${days} days</span>.</p>
                <p>Your account under the email <span class="highlight">${email}</span> has been updated to reflect your new access limits. You can continue streamlining your testing workflows immediately by heading over to your dashboard.</p>
            </div>
            <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Go to Dashboard</a>
            <div class="footer">
                <p>
                    If you did not authorize this change, please contact our 
                    <a href="mailto:info@mnrtechnologies.com" style="color: #f97316; text-decoration: none;">support team</a> immediately.
                </p>
                <p>
                    If you have any questions or need further assistance, please feel free to reach out to us at
                    <a href="mailto:info@mnrtechnologies.com" style="color: #f97316; text-decoration: none;">info@mnrtechnologies.com</a>.
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