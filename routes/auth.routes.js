import express from "express";
import * as AuthController from "../controllers/auth.controller.js";
import { validateSignup, validateLogin } from "../middlewares/validate.middleware.js";
import { checkEmailExistence, checkEmailInDB, checkEmailInDBForLogin, checkVisitor } from "../middlewares/verifyemail.middleware.js";
import { logout, refreshToken } from "../authentication/index.js";
import { checkAccess, checkAccessForGoogleAuth, checkAccessForSignup } from "../middlewares/auth.middleware.js";

const AuthRouter = express.Router();

AuthRouter.post("/signup", validateSignup, checkEmailExistence, checkAccessForSignup, checkEmailInDB, checkVisitor, AuthController.signup);

AuthRouter.post("/verifysignupotp", AuthController.VerifyOTPForSignup);

AuthRouter.post("/login", validateLogin, checkEmailExistence, checkEmailInDBForLogin, checkAccess, checkVisitor, AuthController.login);

AuthRouter.post("/verifysigninotp", AuthController.VerifyOTPForSignin);

AuthRouter.post("/google-auth", checkEmailExistence, checkAccessForGoogleAuth, checkVisitor, AuthController.verifyGoogleAuth);

AuthRouter.post("/forgotPasswordEmail", checkEmailExistence, checkEmailInDBForLogin, checkAccess, checkVisitor, AuthController.ForgotPasswordEmail);

AuthRouter.post("/change-password", AuthController.ChangePassword);

AuthRouter.post("/delete-otp", AuthController.deleteOTP);

AuthRouter.get("/refresh-token", refreshToken);

AuthRouter.post("/logout", logout);

AuthRouter.post("/secure-login", validateLogin, checkEmailExistence, checkEmailInDBForLogin, checkAccess, checkVisitor, AuthController.VerifySignin);

export default AuthRouter;
