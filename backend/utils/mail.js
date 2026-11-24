import nodemailer from "nodemailer"

// Email delivery
// ---------------
// Render's free tier (and many other hosts) block outbound SMTP ports, so on a
// server we send through Brevo's HTTPS API (set BREVO_API_KEY + MAIL_FROM).
// For local development you can still use Gmail SMTP (set EMAIL + PASS).

let smtpTransporter = null

const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS
      }
    })
  }
  return smtpTransporter
}

const sendMail = async ({ to, subject, html }) => {
  if (process.env.BREVO_API_KEY) {
    const sender = process.env.MAIL_FROM || process.env.EMAIL

    if (!sender) {
      throw new Error("MAIL_FROM is required when BREVO_API_KEY is set")
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        sender: { name: "Delicious", email: sender },
        to: [{ email: to }],
        subject,
        htmlContent: html
      })
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`Brevo email failed (${response.status}): ${detail}`)
    }
    return
  }

  if (process.env.EMAIL && process.env.PASS) {
    await getSmtpTransporter().sendMail({
      from: process.env.EMAIL,
      to,
      subject,
      html
    })
    return
  }

  throw new Error("Email is not configured. Set BREVO_API_KEY + MAIL_FROM (or EMAIL + PASS for local dev).")
}

export const sendOtpMail = async (to, otp) => {
  await sendMail({
    to,
    subject: "Reset Your Password",
    html: `<p>Your OTP for password reset is <b>${otp}</b>. It expires in 5 minutes.</p>`
  })
}

export const sendDeliveryOtpMail = async (user, otp) => {
  await sendMail({
    to: user.email,
    subject: "Delivery OTP",
    html: `<p>Your OTP for delivery is <b>${otp}</b>. Share it with the delivery partner only when you receive your order. It expires in 10 minutes.</p>`
  })
}
