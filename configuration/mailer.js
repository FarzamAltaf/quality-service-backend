import nodemailer from "nodemailer";
import config from "./index.js";

const transporter = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.port === 465,
    auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
    }
});

export const sendMail = async ({ to, subject, html, text }) => {
    try {
        const info = await transporter.sendMail({
            from: `"${config.ProjectTitle}" <${config.email.from}>`,
            to,
            subject,
            html,
            text
        });
        console.log("Email sent successfully");
        return info;
    } catch (error) {
        console.error("Failed to send email");
        throw error;
    }
};
