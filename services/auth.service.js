import configuration from "../configuration/index.js";
import User from "../models/users.js";
import Defaults from "../models/defaults.js";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken } from "../utils/token.util.js";
import Visitor from "../models/visitors.js";
import { v4 as uuidv4 } from "uuid";
import OTP from "../models/otp.js";
import { sendMail } from "../configuration/mailer.js";
import { generateEmailTemplate } from "../Emails/main.js";
import Role from "../models/roles.js";
import Module from "../models/modules.js";

export const registerUserWithOTP = async ({ username, email, password, query }) => {

    const defaults = await Defaults.findOne({ prior: "Role" });

    if (!defaults) throw new Error("Unable to set up your account. Please try again later.");

    const hashedPassword = await bcrypt.hash(password, configuration.bcryptRounds);

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const otpId = uuidv4();

    const expiresAt = new Date(Date.now() + 60 * 1000);

    try {
        await OTP.deleteMany({ email });

        const newOtp = await OTP.create({
            username, email, password: hashedPassword, query, otpCode, otpId, expiresAt
        });
    } catch (err) {
        console.error("OTP Save Error:", err.message);
    }

    const emailHTML = generateEmailTemplate({
        title: `Your Verification OTP - ${configuration.ProjectTitle}`,
        username: username,
        body: `Your One-Time Password (OTP) for verification is <b>${otpCode}</b>. 
           It will expire in <b>1 minute</b>. Please do not share this code with anyone.`,
        button: `<a href="${configuration.frontendUrl}/auth/verify/${otpId}" target="_blank" class="button" style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
          border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">Verify OTP</a>`
    });

    await sendMail({
        to: email,
        subject: "OTP For Email Verification",
        html: emailHTML,
        text: `Your OTP is ${otpCode}. It will expire in 1 minute. Please do not share it with anyone.`,
    });

    return {
        message: "A verification code has been sent to your email.", username, email, otpId
    };
};

export const verifyOTPAndCreateUser = async ({ otpId, otpCode }) => {
    const otpObj = await OTP.findOne({ otpId: otpId });

    if (!otpObj) {
        throw new Error("This verification code is invalid or has already expired. Please request a new one.");
    }

    if (!otpCode) {
        throw new Error("Please enter the verification code sent to your email.");
    }

    if (otpObj.otpCode !== otpCode) {
        throw new Error("The verification code you entered is incorrect. Please try again.");
    }

    if (otpObj.expiresAt < new Date()) {
        throw new Error("This verification code has expired. Please request a new one.");
    }

    const { username, email, password, query } = otpObj;

    const defaults = await Defaults.findOne({ prior: "Role" });
    if (!defaults) throw new Error("We could not assign a role to your account. Please contact support.");

    const existingVisitor = await Visitor.findById(query);
    if (!existingVisitor) throw new Error("Your session could not be verified. Please try signing up again.");

    let user = await User.findOne({ email });
    const currentTime = Date.now();
    const newUid = uuidv4();


    if (!user) {
        user = await User.create({
            username,
            email,
            password,
            profile_pic: "https://res.cloudinary.com/dd2alel5h/image/upload/v1759061203/user-image_cs4soq.png",
            query: [existingVisitor._id],
            role: defaults.roleId,
            timeAdded: Date.now().toString()
        });
    } else {
        user.username = username;
        user.password = password;
        user.access.active = true;
        user.access.suspend = false;
        user.subscribed = true;
        user.firstLogin = false;
        user.lastLoginAt = currentTime;
        user.uid = newUid;
        await user.save();
    }


    const roleData = await Role.findById(user.role).lean();

    if (!roleData) {
        throw new Error("Role not found for this user.");
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
                    status: moduleDoc.status
                },
                actions: perm.actions
            };
        })
    );

    const filteredPermissions = permissionsData.filter(Boolean);

    const routeRole = roleData.name = roleData.name?.toLowerCase() ?? "";
    const redirectRoute = `/${routeRole}/${user.uid}`

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });
    await OTP.deleteOne({ otpId });


    const emailHTML = generateEmailTemplate({
        title: `Welcome to ${configuration.ProjectTitle}!`,
        username: user.username,
        body: `
       <span style="color: #bbbbbb;">
        We’re delighted to have you onboard with us.<br><br>
        Your account has been created and verified successfully.<br>
        From now on, you can sign in anytime using your email and password.<br><br>
        Explore your dashboard and start making the most out of ${configuration.ProjectTitle}.
        </span>
    `,
        button: `<a href="${configuration.frontendUrl}/" target="_blank" class="button" 
        style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
        border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">
        Go to Dashboard
    </a>`
    });

    await sendMail({
        to: email,
        subject: `Welcome ${user.username} - ${configuration.ProjectTitle}`,
        html: emailHTML,
        text: `Welcome ${user.username}! Your account has been created and verified successfully. 
               You can now sign in and explore ${configuration.ProjectTitle}.`
    });

    const userObj = {
        id: user._id,
        username: user.username,
        email: user.email,
        profile_pic: user.profile_pic,
        g_auth: user.googleAuth,
        theme: user.theme,
        uid: user.uid,
        redirectRoute,
        role: {
            name: roleData.name,
            slug: roleData.slug,
            uid: roleData.uid,
            permissions: filteredPermissions
        }
    };

    return {
        message: "Your account has been verified successfully. You are now signed in.",
        user: userObj,
        accessToken,
        refreshToken
    };
};

export const loginUser = async ({ query, email, password }) => {
    const visitor = await Visitor.findById(query);
    if (!visitor) {
        throw new Error("Your session could not be verified. Please try again.");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new Error("We couldn’t find an account with these credentials.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("The email or password you entered is incorrect.");
    }

    const queryExists = user.query.some(
        (q) => q.toString() === query.toString()
    );
    if (!queryExists) {
        user.query.push(visitor._id);
        await user.save();
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = uuidv4();
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);

    await OTP.deleteMany({ email });

    await OTP.create({
        username: user.username,
        email,
        password: user.password,
        query,
        otpCode,
        otpId,
        expiresAt,
    });

    const emailHTML = generateEmailTemplate({
        title: `Your Login OTP - ${configuration.ProjectTitle}`,
        username: user.username,
        body: `Your One-Time Password (OTP) for login is <b>${otpCode}</b>. 
           It will expire in <b>1 minute</b>. Please do not share this code with anyone.`,
        button: `<a href="${configuration.frontendUrl}/auth/verify/${otpId}" target="_blank" class="button" style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
        border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">Verify OTP</a>`
    });

    await sendMail({
        to: email,
        subject: `Your Login OTP - ${configuration.ProjectTitle}`,
        html: emailHTML,
        text: `Your OTP is ${otpCode}. It will expire in 1 minute. Please do not share it with anyone.`,
    });

    return {
        message: "A verification code has been sent to your email. Please check your inbox.",
        username: user.username,
        email: user.email,
        otpId
    };
};

export const verifyOTPAndLoginUser = async ({ otpId, otpCode }) => {
    // 1. Check OTP
    const otpObj = await OTP.findOne({ otpId });
    if (!otpObj) {
        throw new Error("This verification code is invalid or has already expired. Please request a new one.");
    }

    if (!otpCode) {
        throw new Error("Please enter the verification code sent to your email.");
    }

    if (otpObj.otpCode !== otpCode) {
        throw new Error("The verification code you entered is incorrect. Please try again.");
    }

    if (otpObj.expiresAt < new Date()) {
        throw new Error("This verification code has expired. Please request a new one.");
    }

    // 2. Get user + visitor
    const { email, query } = otpObj;

    const visitor = await Visitor.findById(query);
    if (!visitor) throw new Error("Your session could not be verified. Please try signing in again.");

    const user = await User.findOne({ email });
    if (!user) throw new Error("No account was found with this email address. Please create an account first.");

    const queryExists = user.query.some(
        (q) => q.toString() === visitor._id.toString()
    );
    if (!queryExists) {
        user.query.push(visitor._id);
    }

    // 4. Handle first login flag
    if (user.firstLogin) {
        user.firstLogin = false;
    }
    if (user.googleAuth) {
        user.googleAuth = false;
    }

    // 5. Handle lastLoginAt + timeAdded
    if (user.timeAdded) {
        user.lastLoginAt = user.timeAdded;
    }
    user.timeAdded = Date.now().toString();
    user.googleAuth = false;

    const newUid = uuidv4();
    user.uid = newUid;

    await user.save();


    const roleData = await Role.findById(user.role).lean();
    if (!roleData) {
        throw new Error("Role not found for this user.");
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
                    status: moduleDoc.status
                },
                actions: perm.actions
            };
        })
    );

    const filteredPermissions = permissionsData.filter(Boolean);

    const routeRole = roleData.name = roleData.name?.toLowerCase() ?? "";
    const redirectRoute = `/${routeRole}/${user.uid}`

    const userObj = {
        id: user._id,
        username: user.username,
        email: user.email,
        profile_pic: user.profile_pic,
        g_auth: user.googleAuth,
        theme: user.theme,
        uid: user.uid,
        redirectRoute,
        role: {
            name: roleData.name,
            slug: roleData.slug,
            uid: roleData.uid,
            permissions: filteredPermissions
        }
    };

    // 6. Tokens
    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });

    // 7. Cleanup OTP
    await OTP.deleteOne({ otpId });

    const emailHTML = generateEmailTemplate({
        title: `Welcome to ${configuration.ProjectTitle}!`,
        username: user.username,
        body: `
        <span style="color: #bbbbbb;">
            Welcome ${user.firstLogin ? 'to' : 'back to'} ${configuration.ProjectTitle}!<br><br>

            Your account has been verified successfully and you are now signed in.<br>
            For your protection, this login was completed using a secure verification process.<br><br>

            You can now access your dashboard and start using all the features of ${configuration.ProjectTitle}.<br><br>

            We’re glad to have you ${user.firstLogin ? 'with us' : 'continuing with us'}!
        </span>
    `,
        button: `<a href="${configuration.frontendUrl}/" target="_blank" class="button" 
        style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
        border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">
        Go to Dashboard
    </a>`
    });

    await sendMail({
        to: email,
        subject: `Welcome ${user.username} - ${configuration.ProjectTitle}`,
        html: emailHTML,
        text: `Welcome ${user.username}! You have successfully signed in using your Google account. 
           You can now access your dashboard and explore ${configuration.ProjectTitle}.`
    });

    return {
        message: "Your account has been verified successfully. You are now signed in.",
        user: userObj,
        accessToken,
        refreshToken
    };
};

export const ForgotPasswordEmail = async ({ email, query }) => {
    if (!email) {
        throw new Error("Please enter the email address associated with your account.");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new Error("We couldn’t find any account registered with this email address.");
    }

    const uid = user.uid;
    const forgotPasswordLink = `${configuration.frontendUrl}/auth/forgot-password/${uid}`;

    if (user && Array.isArray(user.query) && user.query.includes(query)) {
        const emailHTML = generateEmailTemplate({
            title: `Password Reset Request - ${configuration.ProjectTitle}`,
            username: user.username,
            body: `
                We received a request to reset the password for your account <b>${user.email}</b>.<br><br>
                Please click the button below to create a new password.
            `,
            button: `<a href="${forgotPasswordLink}" target="_blank" class="button" 
                style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
                border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">
                Reset Password
            </a>`
        });

        await sendMail({
            to: email,
            subject: `Password Reset Request - ${configuration.ProjectTitle}`,
            html: emailHTML,
            text: `Hello ${user.username}, 
                   We received a request to reset your password. 
                   Use the link below to proceed: ${forgotPasswordLink}. 
                   If this wasn’t you, ignore this email.`
        });

        return {
            message: "We’ve sent a password reset link to your registered email address.",
            username: user.username,
            email: user.email,
            uid
        };
    } else {
        const visitorObj = await Visitor.findById(query);

        const suspiciousInfo = visitorObj
            ? `A suspicious forgot password attempt was detected from device: ${visitorObj.device}, located in ${visitorObj.city}, ${visitorObj.regionName}, ${visitorObj.country}.`
            : "A suspicious forgot password attempt was detected.";

        const emailHTML = generateEmailTemplate({
            title: `Suspicious Password Reset Attempt - ${configuration.ProjectTitle}`,
            username: user.username,
            body: `
                ${suspiciousInfo}<br><br>
                If this was you, please confirm by clicking the button below.
            `,
            button: `<a href="${forgotPasswordLink}" target="_blank" class="button" 
                style="font-size:14px; font-weight:600; color:#fff; background-color:#d97706; 
                border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">
                Confirm Password Reset
            </a>`
        });

        await sendMail({
            to: email,
            subject: `Suspicious Password Reset Attempt - ${configuration.ProjectTitle}`,
            html: emailHTML,
            text: `Hello ${user.username}, 
                   ${suspiciousInfo}. 
                   If this was you, confirm here: ${forgotPasswordLink}. 
                   If not, ignore this email.`
        });

        return {
            message: "We’ve sent a password reset link to your registered email address.",
            username: user.username,
            email: user.email,
            uid
        };
    }
};

export const changePassword = async ({ uid, password }) => {
    if (!uid || !password) {
        throw new Error("Please provide your new password.");
    }

    // Password strength validation
    if (!/(?=.*[a-z])/.test(password)) throw new Error("Password must contain at least one lowercase letter.");
    if (!/(?=.*[A-Z])/.test(password)) throw new Error("Password must contain at least one uppercase letter.");
    if (!/(?=.*\d)/.test(password)) throw new Error("Password must contain at least one number.");
    if (!/(?=.*[@$!%*?&])/.test(password)) throw new Error("Password must contain at least one special character.");
    if (password.length < 7) throw new Error("Password must be at least 7 characters long.");

    // Find user
    const user = await User.findOne({ uid });
    if (!user) {
        throw new Error("No user found for the provided account.");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, configuration.bcryptRounds);
    user.password = hashedPassword;

    // Generate new UID
    const newUid = uuidv4();
    user.uid = newUid;
    await user.save();

    const emailHTML = generateEmailTemplate({
        title: `Your Password Has Been Updated - ${configuration.ProjectTitle}`,
        username: user.username,
        body: `
        This is a confirmation that the password for your account <b>${user.email}</b> 
        has been successfully updated.<br><br>
        If you made this change, no further action is needed.<br>
        If you did not request a password reset, please secure your account immediately 
        by resetting your password again or contacting our support team.
    `,
        button: `<a href="${configuration.frontendUrl}/auth/signin" target="_blank" class="button" 
        style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
        border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">
        Sign in to Your Account
    </a>`
    });

    await sendMail({
        to: user.email,
        subject: `Password Changed Successfully - ${configuration.ProjectTitle}`,
        html: emailHTML,
        text: `Hello ${user.username}, your password has been updated successfully. 
           If this wasn’t you, please reset your password immediately or contact support.`
    });


    return {
        message: "Your password has been updated successfully.",
    };
};

export const googleAuth = async ({ username, email, uid, profile_pic, query }) => {
    const visitor = await Visitor.findById(query);
    if (!visitor) throw new Error("Your session could not be verified. Please try again.");
    if (!uid || !email) throw new Error("Invalid Google account data received. Please try again.");

    let user = await User.findOne({ email });

    if (!user) {
        const defaults = await Defaults.findOne({ prior: "Role" });
        if (!defaults) throw new Error("Unable to assign a default role. Please contact support.");

        user = await User.create({
            username,
            email,
            g_uid: uid,
            password: "$2b$10$lvTvdmmMdgGmfPH10tq4kO/jAhGugImhwFSN3a7fSIQhWrSNxGO16",
            profile_pic,
            query: [query],
            googleAuth: true,
            role: defaults.roleId,
            timeAdded: Date.now().toString()
        });
    } else {
        // Update existing user
        if (!user.access.active) user.username = username;
        if (!user.query.includes(visitor._id)) user.query.push(visitor._id);
        if (user.firstLogin) user.firstLogin = false;
        if (!user.googleAuth) user.googleAuth = true;
        if (user.timeAdded) user.lastLoginAt = user.timeAdded;
        user.timeAdded = Date.now().toString();
        user.access.active = true;
        user.access.suspend = false;
        // Store g_uid if it doesn't exist yet
        if (!user.g_uid) user.g_uid = uid;
        user.profile_pic = profile_pic;

        await user.save();
    }


    const roleData = await Role.findById(user.role).lean();
    if (!roleData) {
        throw new Error("Role not found for this user.");
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
                    status: moduleDoc.status
                },
                actions: perm.actions
            };
        })
    );

    const filteredPermissions = permissionsData.filter(Boolean);


    const routeRole = roleData.name = roleData.name?.toLowerCase() ?? "";
    const redirectRoute = `/${routeRole}/${user.uid}`


    const userObj = {
        id: user._id,
        username: user.username,
        email: user.email,
        profile_pic: user.profile_pic,
        g_auth: user.googleAuth,
        uid: user.uid,
        theme: user.theme,
        redirectRoute,
        role: {
            name: roleData.name,
            slug: roleData.slug,
            uid: roleData.uid,
            permissions: filteredPermissions
        }
    };

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });


    const emailHTML = generateEmailTemplate({
        title: `Welcome to ${configuration.ProjectTitle}!`,
        username: username,
        body: `
        <span style="color:#bbbbbb;">We’re excited to have you ${user.firstLogin ? 'onboard' : 'back'} with us.<br><br>
        You have successfully signed in using your Google account.<br>
        From now on, you can easily access your account without remembering another password.<br><br>
        Explore your dashboard and start making the most out of ${configuration.ProjectTitle}.</span>
    `,
        button: `<a href="${configuration.frontendUrl}/" target="_blank" class="button" 
        style="font-size:14px; font-weight:600; color:#fff; background-color:#ff4b2b; 
        border-radius:8px; padding:10px 25px; text-decoration:none; display:inline-block;">
        Go to Dashboard
    </a>`
    });

    await sendMail({
        to: email,
        subject: `Welcome ${username} - ${configuration.ProjectTitle}`,
        html: emailHTML,
        text: `Welcome ${username}! You have successfully signed in using your Google account. 
           You can now access your dashboard and explore ${configuration.ProjectTitle}.`
    });

    return { user: userObj, accessToken, refreshToken };
};


export const verifyLoginUser = async ({ query, email, password }) => {

    const visitor = await Visitor.findById(query);
    if (!visitor) {
        throw new Error("Your session could not be verified. Please try again.");
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new Error("We couldn’t find an account with these credentials.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error("The email or password you entered is incorrect.");
    }

    const queryExists = user.query.some(
        (q) => q.toString() === query.toString()
    );

    if (!queryExists) {
        user.query.push(visitor._id);
        await user.save();
    }

    // 4. Handle first login flag
    if (user.firstLogin) {
        user.firstLogin = false;
    }
    if (user.googleAuth) {
        user.googleAuth = false;
    }

    // 5. Handle lastLoginAt + timeAdded
    if (user.timeAdded) {
        user.lastLoginAt = user.timeAdded;
    }
    user.timeAdded = Date.now().toString();
    user.googleAuth = false;

    const newUid = uuidv4();
    user.uid = newUid;

    await user.save();


    const roleData = await Role.findById(user.role).lean();
    if (!roleData) {
        throw new Error("Role not found for this user.");
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
                    status: moduleDoc.status
                },
                actions: perm.actions
            };
        })
    );

    const filteredPermissions = permissionsData.filter(Boolean);

    const routeRole = roleData.name = roleData.name?.toLowerCase() ?? "";
    const redirectRoute = `/${routeRole}/${user.uid}`

    const userObj = {
        id: user._id,
        username: user.username,
        email: user.email,
        profile_pic: user.profile_pic,
        g_auth: user.googleAuth,
        theme: user.theme,
        uid: user.uid,
        redirectRoute,
        role: {
            name: roleData.name,
            slug: roleData.slug,
            uid: roleData.uid,
            permissions: filteredPermissions
        }
    };

    // 6. Tokens
    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id });

    return {
        message: "Your account has been verified successfully. You are now signed in.",
        user: userObj,
        accessToken,
        refreshToken
    };
};