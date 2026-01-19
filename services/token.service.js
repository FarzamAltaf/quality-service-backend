import User from "../models/users.js";

export const saveRefreshToken = async (userId, refreshToken) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("No account found. Please register first.");

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.refreshTokens.push({ token: refreshToken, expiresAt });
    await user.save();
};

// Remove refresh token from DB (on logout or rotation)
export const removeRefreshToken = async (userId, refreshToken) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("No account found. Please register first.");

    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    await user.save();
};

// Verify refresh token
export const isRefreshTokenValid = async (userId, token) => {
    const user = await User.findById(userId);
    if (!user) return false;

    const storedToken = user.refreshTokens.find(rt => rt.token === token);
    if (!storedToken) return false;
    if (new Date() > storedToken.expiresAt) return false;

    return true;
};