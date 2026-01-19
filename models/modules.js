import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const moduleSchema = new mongoose.Schema(
    {
        uid: {
            type: String,
            unique: true,
            default: uuidv4,
            trim: true,
        },
        isSystem: { type: Boolean, default: true },
        name: { type: String, required: true, unique: true, trim: true },
        slug: { type: String, unique: true, trim: true },
        status: {
            active: { type: Boolean, default: true },
            maintenance: { type: Boolean, default: false },
        },
    },
    { timestamps: true }
);

// Improved slug generation
moduleSchema.pre("save", function (next) {
    if (!this.isModified("name")) return next();

    const formatted = this.name.trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    this.slug = `_${formatted}_`;

    next();
});

const Module = mongoose.model("Module", moduleSchema);
export default Module;