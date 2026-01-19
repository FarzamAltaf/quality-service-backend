import mongoose from "mongoose";

const defaultSchema = new mongoose.Schema(
    {
        prior: { type: String, required: true, unique: true, trim: true, index: true },
        roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    },
    { timestamps: true }
);

const Defaults = mongoose.model("Default", defaultSchema, "defaults");
export default Defaults;
