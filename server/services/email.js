import nodemailer from 'nodemailer';

export async function sendRegistrationCode(email, code) {
  const username = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
  if (!username || !appPassword) throw new Error('Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: username, pass: appPassword },
  });

  await transporter.sendMail({
    from: `Osman Store <${username}>`,
    to: email,
    subject: 'Osman Store email verification code',
    text: `Your Osman Store verification code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:28px;color:#26372b"><h2>Verify your Osman Store account</h2><p>Enter this code to finish creating your account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#247044">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
  });
}
