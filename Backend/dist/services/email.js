"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "465");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || `"FireTalk" <${smtpUser}>`;
const smtpSecure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === "true"
    : smtpPort === 465;
const sendOtpEmail = async (toEmail, otpCode) => {
    if (!smtpUser || !smtpPass) {
        throw new Error("SMTP credentials are not configured in .env. Please add SMTP_USER and SMTP_PASS to your .env file.");
    }
    const transportOptions = {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        family: 4,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    };
    const transporter = nodemailer_1.default.createTransport(transportOptions);
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; color: #3390ec;">FireTalk</span>
      </div>
      <h2 style="color: #333333; text-align: center; margin-bottom: 12px;">Verification Code</h2>
      <p style="color: #666666; font-size: 16px; line-height: 1.5; text-align: center; margin-bottom: 24px;">
        Use this secure one-time code to log in to your FireTalk profile. The code is valid for 5 minutes.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="display: inline-block; font-size: 36px; font-weight: bold; color: #3390ec; letter-spacing: 6px; padding: 12px 24px; background-color: #f0f7ff; border-radius: 8px; border: 1px dashed #3390ec;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #999999; font-size: 12px; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 16px; margin: 0;">
        If you did not request this email, simply ignore it.
      </p>
    </div>
  `;
    await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject: `FireTalk Verification Code: ${otpCode}`,
        text: `Your FireTalk verification code: ${otpCode}. The code is valid for 5 minutes.`,
        html: htmlContent,
    });
};
exports.sendOtpEmail = sendOtpEmail;
