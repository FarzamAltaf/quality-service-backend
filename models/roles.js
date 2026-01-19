import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const PermissionSchema = new mongoose.Schema(
    {
        module: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Module",
            required: true,
        },
        actions: {
            get: { type: Boolean, default: false },
            post: { type: Boolean, default: false },
            put: { type: Boolean, default: false },
            delete: { type: Boolean, default: false },
        },
    },
    { _id: false }
);

const roleSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true, trim: true },
        uid: { type: String, unique: true, trim: true, default: uuidv4 },
        permissions: [PermissionSchema],
        slug: { type: String, unique: true, trim: true, lowercase: true },
    },
    { timestamps: true }
);

// Improved slug generation
roleSchema.pre("save", function (next) {
    if (!this.slug && this.name) {
        const base = this.name.toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
        const hash = crypto.randomBytes(3).toString("hex");
        this.slug = `${base}-${hash}`;
    }
    next();
});

const Role = mongoose.model("Role", roleSchema);
export default Role;