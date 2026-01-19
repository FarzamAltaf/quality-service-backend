import configuration from "../configuration/index.js";
import Module from "../models/modules.js";
import Role from "../models/roles.js";
import User from "../models/users.js";
import * as TokenService from "../services/token.service.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/token.util.js";

// REFRESH TOKEN
export const refreshToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) return res.status(401).json({ status: false, message: "No refresh token" });

        const payload = verifyRefreshToken(token);

        // check DB
        const valid = await TokenService.isRefreshTokenValid(payload.id, token);
        if (!valid) return res.status(401).json({ status: false, message: "Invalid refresh token" });

        const user = await User.findById(payload.id);

        if (user.access.active && user.access.suspend) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account has been suspended. Please contact support."
            });
        }

        if (!user.access.active && !user.access.suspend) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account has been deleted. Please contact support."
            });
        }

        if (!user.access.active) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account is inactive. Please contact support."
            });
        }


        if (user.access.suspend) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account has been suspended. Please contact support."
            });
        }


        // Get full role info (with permissions)
        const roleData = await Role.findById(user.role).lean();

        if (!roleData) {
            return res.status(404).json({ status: false, message: "Role not found" });
        }

        // Build permissions array
        const permissionsData = await Promise.all(
            roleData.permissions.map(async (perm) => {
                const moduleDoc = await Module.findById(perm.module).lean();
                if (!moduleDoc) return null;

                return {
                    module: {
                        slug: moduleDoc.slug,
                        uid: moduleDoc.uid,
                        status: moduleDoc.status,
                    },
                    actions: perm.actions
                };
            })
        );

        // Filter out null (in case a module was deleted)
        const filteredPermissions = permissionsData.filter(Boolean);

        const routeRole = roleData.name = roleData.name?.toLowerCase() ?? "";
        const redirectRoute = `/${routeRole}/${user.uid}`


        // generate new tokens
        const accessToken = signAccessToken({ id: user._id, role: user.role });
        const newRefreshToken = signRefreshToken({ id: user._id });

        // remove old refresh token
        await TokenService.removeRefreshToken(user._id, token);

        // store new refresh token
        await TokenService.saveRefreshToken(user._id, newRefreshToken);

        // res.cookie("refreshToken", newRefreshToken, {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === "production",
        //     sameSite: "lax",
        //     path: "/",
        //     maxAge: 7 * 24 * 60 * 60 * 1000,
        // });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            status: true,
            accessToken,
            user: {
                username: user.username,
                email: user.email,
                uid: user.uid,
                theme: user.theme,
                redirectRoute,
                profile_pic: user.profile_pic,
                g_auth: user.googleAuth,
                role: {
                    name: roleData.name,
                    slug: roleData.slug,
                    uid: roleData.uid,
                    permissions: filteredPermissions
                }
            },
        });
    } catch (err) {
        console.error(err);
        res.status(401).json({ status: false, message: "Invalid refresh token" });
    }
};

// LOGOUT
export const logout = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (token) {
            const payload = verifyRefreshToken(token);

            // Remove only the object with matching token
            await User.updateOne(
                { _id: payload.id },
                { $pull: { refreshTokens: { token } } }
            );
        }

        // Clear cookie
        // res.clearCookie("refreshToken", {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === "production",
        //     sameSite: "lax",
        // });

        // Clear cookie
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
        });

        res.status(200).json({ status: true, message: "You have been logged out successfully." });
    } catch (err) {
        res.status(500).json({ status: false, message: "Unable to log out at the moment." });
    }
};