const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to your email provider (e.g. Outlook, SendGrid)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // For Gmail, use an App Password
  },
});

/**
 * Send an OTP code to the provided email address
 * @param {string} toEmail - The recipient's email address
 * @param {string} otp - The 6-digit OTP code to send
 */
async function sendOTPEmail(toEmail, otp) {
  const mailOptions = {
    from: `"UrbanPulse Security" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your UrbanPulse Verification Code',
    text: `Your one-time password (OTP) is: ${otp}. This code expires in 5 minutes.`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #0d9488;">Verification Code</h2>
        <p>Hello,</p>
        <p>Your one-time password (OTP) to authenticate with UrbanPulse is:</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px solid #e2e8f0;">
          <strong style="font-size: 36px; letter-spacing: 6px; color: #0f172a;">${otp}</strong>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5;">This code will expire in exactly 5 minutes. Please do not share this code with anyone. If you did not request this OTP, please safely ignore this email or secure your account.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">UrbanPulse Team • Making Cities Greener</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email dispatched successfully to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Failed to send OTP email via Nodemailer:', error);
    return false;
  }
}

/**
 * Send a rich email notification to the selected buyer.
 * @param {string} toEmail       - Buyer's email address
 * @param {string} itemName      - Name of the item they've been selected for
 * @param {Object} sellerInfo    - { name, email } of the seller
 */
async function sendBuyerSelectedEmail(toEmail, itemName, sellerInfo = {}) {
  const sellerName  = sellerInfo.name  || 'the seller';
  const sellerEmail = sellerInfo.email || '';

  const sellerContact = sellerEmail
    ? `<p>You can reach out to <strong>${sellerName}</strong> directly at <a href="mailto:${sellerEmail}" style="color:#0d9488;">${sellerEmail}</a> to arrange the pickup or exchange.</p>`
    : `<p>Please log in to the platform to contact <strong>${sellerName}</strong> and arrange the barter / pickup.</p>`;

  const mailOptions = {
    from: `"EcoBarter+" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `🎉 You've been selected for "${itemName}" on EcoBarter+!`,
    text: [
      `Great news! You have been selected as the recipient for the item: "${itemName}".`,
      `Seller: ${sellerName}${sellerEmail ? ' (' + sellerEmail + ')' : ''}.`,
      `Log in to EcoBarter+ to confirm the exchange and arrange pickup with the seller.`,
      `— EcoBarter+ Team`,
    ].join('\n\n'),
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>You've Been Selected – EcoBarter+</title>
      </head>
      <body style="margin:0;padding:0;background:#f0fdf4;font-family:'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:40px 16px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#0d9488 0%,#059669 100%);padding:36px 40px;text-align:center;">
                    <h1 style="margin:0;font-size:28px;color:#ffffff;letter-spacing:-0.5px;">🌿 EcoBarter+</h1>
                    <p style="margin:8px 0 0;color:#d1fae5;font-size:14px;">Sustainable Exchange, Greener Planet</p>
                  </td>
                </tr>

                <!-- Congrats Banner -->
                <tr>
                  <td style="padding:36px 40px 0;text-align:center;">
                    <div style="display:inline-block;background:#ecfdf5;border:2px solid #6ee7b7;border-radius:50%;width:72px;height:72px;line-height:72px;font-size:36px;">🎉</div>
                    <h2 style="margin:20px 0 8px;font-size:24px;color:#064e3b;">Congratulations!</h2>
                    <p style="margin:0;font-size:16px;color:#374151;">You have been selected as the recipient for:</p>
                  </td>
                </tr>

                <!-- Item Card -->
                <tr>
                  <td style="padding:24px 40px;">
                    <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:12px;padding:20px 24px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Item</p>
                      <p style="margin:0;font-size:22px;font-weight:700;color:#065f46;">${itemName}</p>
                    </div>
                  </td>
                </tr>

                <!-- Seller Info -->
                <tr>
                  <td style="padding:0 40px 24px;">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
                      <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:600;">Seller Information</p>
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="width:32px;vertical-align:top;padding-top:2px;">👤</td>
                          <td>
                            <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;">${sellerName}</p>
                            ${sellerEmail
                              ? `<p style="margin:4px 0 0;font-size:14px;"><a href="mailto:${sellerEmail}" style="color:#0d9488;text-decoration:none;">${sellerEmail}</a></p>`
                              : ''}
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- Confirmation Message -->
                <tr>
                  <td style="padding:0 40px 32px;font-size:15px;color:#374151;line-height:1.7;">
                    <p style="margin:0 0 12px;">This is your official confirmation that the seller has chosen you for this item. Here's what to do next:</p>
                    <ol style="margin:0;padding-left:20px;color:#374151;">
                      <li style="margin-bottom:8px;">Log in to your <strong>EcoBarter+</strong> account.</li>
                      <li style="margin-bottom:8px;">Check your <strong>Notifications</strong> for full details.</li>
                      <li>${sellerContact.replace(/<\/?p[^>]*>/g, '')}</li>
                    </ol>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding:0 40px 40px;text-align:center;">
                    <a href="http://localhost:5173/notifications"
                       style="display:inline-block;background:linear-gradient(135deg,#0d9488,#059669);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      View My Notifications →
                    </a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;">
                      You're receiving this because a seller on EcoBarter+ selected you.<br/>
                      &copy; ${new Date().getFullYear()} EcoBarter+ · Sustainable Exchange Platform
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Buyer-selected email dispatched to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send buyer-selected email:', error.message);
    return false;
  }
}

/**
 * Send a QR Code email to the buyer for an item they will pick up.
 * @param {string} toEmail - Buyer's email address
 * @param {string} itemName - Name of the item
 * @param {string} token - The transaction token
 * @param {string} qrDataURL - The base64 generated QR code image string
 */
async function sendQREmail(toEmail, itemName, token, qrDataURL) {
  const mailOptions = {
    from: `"EcoBarter+" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: `Your QR Code for "${itemName}" is ready!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your QR Code for ${itemName}</h2>
        <p>The seller has generated a QR code for your transaction.</p>
        <p>Please present this QR code to the seller when picking up the item. Or, you can manually provide this token code:</p>
        <div style="background-color: #f8fafc; padding: 10px; border-radius: 4px; text-align: center; margin: 20px 0;">
          <strong>${token}</strong>
        </div>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${qrDataURL}" alt="Your QR Code" style="max-width: 250px; border: 1px solid #ccc; padding: 10px;" />
        </div>
        <p>Thank you for using EcoBarter+!</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] QR email dispatched to ${toEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send QR email:', error.message);
    return false;
  }
}

module.exports = {
  sendOTPEmail,
  sendBuyerSelectedEmail,
  sendQREmail
};
