import axios from "axios";
import { emailVerifier } from "../api/api.js";
import User from "../models/users.js";
import Visitor from "../models/visitors.js";

export const checkEmailExistence = async (req, res, next) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: false, message: "Email address is required." });

    try {
        const verifyUrl = `${emailVerifier}${email}`;
        const { data } = await axios.get(verifyUrl);
        if (data.smtpCheck !== "true") {
            return res.status(400).json({ status: false, message: "The provided email address is not valid." });
        }
        next();
    } catch (err) {
        console.warn("Email verification service unavailable, proceeding without verification");
        next();
    }
};

export const checkEmailInDB = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email)
            return res.status(400).json({ status: false, message: "Email address is required." });

        const user = await User.findOne({ email });

        if (user) {
            if (!user.access.active && !user.access.suspend) {
                return next();
            }
        }

        if (user) {
            return res.status(409).json({ status: false, message: "An account with this email already exists." });
        }

        next();
    } catch (err) {
        return res.status(500).json({ status: false, message: "Internal server error." });
    }
};

export const checkEmailInDBForLogin = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: false, message: "Email address is required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                status: false, message: "No account found with this email. Please register first."
            });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(500).json({ status: false, message: "Internal server error." });
    }
};

export const checkVisitor = async (req, res, next) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, message: "Identifier is required." });
        }

        const visitor = await Visitor.findById(query);

        if (!visitor) {
            return res.status(404).json({ status: false, refresh: true, message: "Suspicious request detected" });
        }

        next();
    } catch (err) {
        return res.status(500).json({ status: false, refresh: true, message: "Suspicious request detected. Please try again." });
    }
};