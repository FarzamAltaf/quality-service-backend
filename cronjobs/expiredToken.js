import cron from "node-cron";
import User from "../models/users.js";

cron.schedule("0 * * * *", async () => {
    try {
        const now = new Date(new Date().toISOString());

        // Fetch all users who have at least one expired token
        const users = await User.find({
            "refreshTokens.expiresAt": { $lte: now }
        }).lean(); // lean() for plain JS objects

        if (users.length === 0) {
            console.log(`⏳ Cronjob ran. No expired tokens found at ${now.toISOString()}`);
            return;
        }

        for (let user of users) {
            const expiredTokens = user.refreshTokens.filter(t => new Date(t.expiresAt) <= now);

            if (expiredTokens.length === 0) continue;

            await User.updateOne(
                { _id: user._id },
                { $pull: { refreshTokens: { expiresAt: { $lte: now } } } }
            );

            console.log(
                `✅ User: ${user.username}, removed ${expiredTokens.length} expired token(s) at ${now.toISOString()}`
            );
        }
    } catch (error) {
        console.error("❌ Error cleaning expired tokens:", error);
    }
});
