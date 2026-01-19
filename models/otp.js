import mongoose from "mongoose";

const OTPSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    query: { type: String, required: true },
    otpCode: { type: String, required: true },
    otpId: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false }
}, { timestamps: true });

const OTP = mongoose.model("OTP", OTPSchema);
export default OTP;
