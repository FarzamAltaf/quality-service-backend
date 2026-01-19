import jwt from "jsonwebtoken";
import configuration from "../configuration/index.js";

export const signAccessToken = (payload) => {
    return jwt.sign(payload, configuration.jwt.accessSecret, {
        expiresIn: configuration.jwt.accessExpiresIn,
    });
};

export const signRefreshToken = (payload) => {
    return jwt.sign(payload, configuration.jwt.refreshSecret, {
        expiresIn: configuration.jwt.refreshExpiresIn,
    });
};

export const verifyAccessToken = (token) => {
    return jwt.verify(token, configuration.jwt.accessSecret);
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(token, configuration.jwt.refreshSecret);
};
