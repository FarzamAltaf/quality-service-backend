import cron from "node-cron";
import OTP from "../models/otp.js";

// Runs every day at 12:00 AM
cron.schedule("0 0 * * *", async () => {
    try {
        const now = new Date();
        const result = await OTP.deleteMany({ expiresAt: { $lte: now } });

        if (result.deletedCount > 0) {
            console.log(`[CRON] Deleted ${result.deletedCount} expired OTP(s) at ${now.toLocaleString()}`);
        } else {
            console.log("[CRON] No expired OTPs found to delete.");
        }
    } catch (err) {
        console.error("[CRON] Error while deleting expired OTPs:", err.message);
    }
});
