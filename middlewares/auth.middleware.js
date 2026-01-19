import jwt from "jsonwebtoken";
import configuration from "../configuration/index.js";
import User from "../models/users.js";

export const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, configuration.jwt.accessSecret);
        req.user = decoded;
        next();
    } catch {
        return res.status(403).json({ message: "Invalid/Expired token" });
    }
};

export const roleMiddleware = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
};

export const checkAccess = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Email address is required."
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                status: false,
                message: "No account found with this email. Please register first."
            });
        }


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
                message: "No account found with this email. Please register first."
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

        next();

    } catch (err) {
        console.error("Access check error:", err);
        return res.status(500).json({
            status: false,
            verify: true,
            refresh: true,
            message: "Suspicious request detected. Please try again."
        });
    }
};

export const checkAccessForSignup = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Email address is required."
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {

            if (!existingUser.access.active && !existingUser.access.suspend) {
                return next();
            }

            if (existingUser.access.suspend) {
                return res.status(403).json({
                    status: false,
                    message: "This email is linked to a suspended account. Please contact support."
                });
            }

            if (!existingUser.access.active) {
                return res.status(403).json({
                    status: false,
                    message: "Your account is inactive. Please contact support."
                });
            }

            return res.status(409).json({
                status: false,
                message: "An account with this email already exists."
            });
        }

        next();

    } catch (err) {
        console.error("Access check error:", err);
        return res.status(500).json({
            status: false,
            message: "Something went wrong. Please try again."
        });
    }
};

export const checkAccessForGoogleAuth = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Email address is required."
            });
        }

        const user = await User.findOne({ email });

        // If user doesn't exist, just allow GoogleAuth to continue (signup flow)
        if (!user) {
            return next();
        }

        if (user) {
            if (!user.access?.suspend && !user.access?.active) {
                return next();
            }
        }

        // If suspended user tries to log in with Google
        if (user.access?.suspend && user.access?.active) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account has been suspended. Please contact support."
            });
        }

        if (user.access?.suspend) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // If inactive user tries to log in with Google
        if (!user.access?.active) {
            return res.status(403).json({
                status: false,
                verify: true,
                message: "Your account is inactive. Please contact support."
            });
        }

        // Active and not suspended → allow GoogleAuth to proceed (signin flow)
        return next();

    } catch (err) {
        console.error("Google Auth check error:", err);
        return res.status(500).json({
            status: false,
            verify: true,
            refresh: true,
            message: "Suspicious request detected. Please try again."
        });
    }
};

