import dotenv from "dotenv";
dotenv.config();

export default {
    port: process.env.PORT || 8000,
    ProjectTitle: process.env.PROJECT_TITLE,
    NODE_ENV: process.env.NODE_ENV,
    mongoUri: process.env.MONGO_URI,
    emailVerifierKey: process.env.EMAIL_VERIFIER_API_KEY,
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
        refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
    },
    bcryptRounds: parseInt(process.env.SALT || "10", 10),
    CLIENTORIGINS: process.env.CLIENT_ORIGINS,
    frontendUrl: process.env.LOCAL_URL,
    email: {
        from: process.env.EMAIL_FROM,
        smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587", 10),
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    }
};
