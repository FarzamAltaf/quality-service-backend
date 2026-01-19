import configuration from "../configuration/index.js";
import OTP from "../models/otp.js";
import * as AuthService from "../services/auth.service.js";
import * as TokenService from "../services/token.service.js";

export const signup = async (req, res) => {
    try {
        const user = await AuthService.registerUserWithOTP(req.body);
        res.status(201).json({ status: true, data: user });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const VerifyOTPForSignup = async (req, res) => {
    try {
        const result = await AuthService.verifyOTPAndCreateUser(req.body);

        await TokenService.saveRefreshToken(result.user.id, result.refreshToken);

        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: configuration.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        delete result.user.id;

        res.status(200).json({
            status: true,
            message: "Your account has been verified successfully. You are now signed in.",
            user: result.user,
            accessToken: result.accessToken,
        });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const login = async (req, res) => {
    try {
        const user = await AuthService.loginUser(req.body);

        res.status(200).json({ status: true, data: user });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const VerifyOTPForSignin = async (req, res) => {
    try {
        const result = await AuthService.verifyOTPAndLoginUser(req.body);

        await TokenService.saveRefreshToken(result.user.id, result.refreshToken);

        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: configuration.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        delete result.user.id;

        res.status(200).json({
            status: true,
            message: "Your account has been verified successfully. You are now signed in.",
            user: result.user,
            accessToken: result.accessToken,
        });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const verifyGoogleAuth = async (req, res) => {
    try {
        const { username, email, uid, profile_pic, query } = req.body;

        const result = await AuthService.googleAuth({ username, email, uid, profile_pic, query });

        // Save refresh token in DB
        await TokenService.saveRefreshToken(result.user.id, result.refreshToken);

        // Set refresh token cookie
        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: configuration.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        delete result.user.id;

        res.status(200).json({
            status: true,
            message: "Your account has been verified successfully. You are now signed in.",
            user: result.user,
            accessToken: result.accessToken
        });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const ForgotPasswordEmail = async (req, res) => {
    try {
        const user = await AuthService.ForgotPasswordEmail(req.body);

        res.status(200).json({ status: true, data: user });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const ChangePassword = async (req, res) => {
    try {
        const user = await AuthService.changePassword(req.body);

        res.status(200).json({ status: true, data: user });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};

export const deleteOTP = async (req, res) => {
    try {
        const { email, otpId } = req.body;

        const deleted = await OTP.findOneAndDelete({ email, otpId });

        if (!deleted) {
            return res.status(404).json({ status: false, message: "This verification code is no longer valid." });
        }

        res.status(200).json({ status: true, message: "Your verification code has expired. Please request a new one to continue." });
    } catch (err) {
        res.status(500).json({ status: false, message: "Authentication failed. Please try again." });
    }
};

export const VerifySignin = async (req, res) => {
    try {
        const result = await AuthService.verifyLoginUser(req.body);

        await TokenService.saveRefreshToken(result.user.id, result.refreshToken);

        // res.cookie("refreshToken", result.refreshToken, {
        //     httpOnly: true,
        //     secure: configuration.NODE_ENV === "production",
        //     sameSite: "lax",
        //     path: "/",
        //     maxAge: 7 * 24 * 60 * 60 * 1000
        // });

        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });


        delete result.user.id;

        res.status(200).json({
            status: true,
            message: "Your account has been verified successfully. You are now signed in.",
            user: result.user,
            accessToken: result.accessToken,
        });
    } catch (err) {
        res.status(400).json({ status: false, message: err.message });
    }
};
