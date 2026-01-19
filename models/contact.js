import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const contactSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        email: { type: String, required: true, trim: true, index: true, lowercase: true },
        subject: { type: String, trim: true, required: false },
        phone: { type: String, trim: true, required: false },
        message: { type: String, trim: true, required: false },
        query: { type: mongoose.Schema.Types.ObjectId, ref: "Visitor" },
        status: {
            type: Boolean,
            default: false,
            index: true
        },
        uid: { type: String, unique: true, trim: true, default: uuidv4 },
        timeAdded: { type: String, trim: true, required: false },
    },
    { timestamps: true }
);

const Contact = mongoose.model("Contact", contactSchema);
export default Contact;
