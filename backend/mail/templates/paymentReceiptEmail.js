/**
 * Payment receipt. Sent after a payment has been captured AND the entitlement
 * applied — never before, so it can never promise credits that did not land.
 *
 * The headline figure is ALWAYS what the customer was actually charged, in the
 * currency it was charged in: ₹ for an Indian purchase, $ for an international
 * one. On an INR receipt the USD catalog price is shown underneath purely as a
 * reference, matching the disclaimer in pricing.data.json — never as the
 * headline, because that is not the number that left their account.
 */
exports.paymentReceiptEmail = ({
  companyName,
  description,
  amountCharged,
  currency = "INR",
  amountUsd,
  razorpayPaymentId,
  creditsGranted,
  balance,
  endDate,
}) => {
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  const isInr = currency === "INR";
  const symbol = isInr ? "₹" : "$";
  const locale = isInr ? "en-IN" : "en-US";

  const charged = `${symbol}${Number(amountCharged).toLocaleString(locale, {
    minimumFractionDigits: isInr ? 0 : 2,
  })} ${currency}`;

  const rows = [
    ["Item", description || "MNR AI Tester"],
    ["Amount paid", charged],
    // Reference only, and only when the two differ.
    isInr && amountUsd
      ? ["Catalog price", `$${Number(amountUsd).toLocaleString("en-US")} USD`]
      : null,
    creditsGranted > 0 ? ["Credits added", Number(creditsGranted).toLocaleString("en-US")] : null,
    balance !== null && balance !== undefined
      ? ["Available balance", Number(balance).toLocaleString("en-US")]
      : null,
    endDate ? ["Plan active until", fmtDate(endDate)] : null,
    razorpayPaymentId ? ["Payment ID", razorpayPaymentId] : null,
  ].filter(Boolean);

  return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Payment Received - MNR AI Tester</title>
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
            .receipt {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                text-align: left;
                font-size: 15px;
            }
            .receipt td {
                padding: 10px 12px;
                border-bottom: 1px solid #eeeeee;
            }
            .receipt td:first-child {
                color: #888888;
                width: 45%;
            }
            .receipt td:last-child {
                color: #1a1a1a;
                font-weight: 600;
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
            <div class="title">Payment Received</div>
            <div class="content">
                <p>Hello <span class="highlight">${companyName || "there"}</span>,</p>
                <p>Thank you — your payment has gone through and your account has already been updated. Here is your receipt.</p>
            </div>
            <table class="receipt">
                ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
            </table>
            <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Go to Dashboard</a>
            <div class="footer">
                ${
                  isInr
                    ? `<p>You were charged ${charged}. The catalog price is set in USD and converted at the rate shown on your invoice.</p>`
                    : `<p>You were charged ${charged}.</p>`
                }
                <p>
                    If you did not authorize this payment, please contact our
                    <a href="mailto:info@mnrtechnologies.com" style="color: #f97316; text-decoration: none;">support team</a> immediately
                    and quote the payment ID above.
                </p>
                <br>
                Best Regards,<br>
                <strong>The MNR AI Tester Team</strong>
            </div>
        </div>
    </body>
    </html>`;
};
