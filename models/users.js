import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const RefreshTokenSchema = new mongoose.Schema({
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
});

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, trim: true, index: true },
        email: { type: String, required: true, unique: true, trim: true, index: true, lowercase: true },
        password: { type: String, required: true },
        query: [{ type: mongoose.Schema.Types.ObjectId, ref: "Visitor" }],
        role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
        uid: { type: String, unique: true, trim: true, default: uuidv4 },
        g_uid: { type: String },
        profile_pic: { type: String, trim: true, required: false },
        phone: { type: String, trim: true, required: false },
        timeAdded: { type: String, trim: true, required: false },
        theme: { type: Boolean, default: true },
        firstLogin: { type: Boolean, default: true },
        googleAuth: { type: Boolean, default: false },
        subscribed: { type: Boolean, default: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
        lastLoginAt: { type: String, trim: true, required: false },
        access: {
            active: { type: Boolean, default: true },
            suspend: { type: Boolean, default: false },
        },
        refreshTokens: [RefreshTokenSchema]
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
