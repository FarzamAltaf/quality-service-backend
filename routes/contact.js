import express from "express";
import Contact from "../models/contact.js";
import checkPermission from "../middlewares/checkRole.js";

const ContactRouter = express.Router();

ContactRouter.post("/", async (req, res) => {
    try {
        const objData = req.body;
        if (!objData) {
            return res.status(400).json({ status: false, message: "Data is required" });
        }

        if (!objData.query) {
            return res.status(400).json({ status: false, message: "Suspicious activity detected" });
        }


        const contact = await Contact.create({
            ...objData
        });

        return res.status(200).json({
            success: true,
            message: "Thank you! Your message has been sent successfully.",
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: false, message: "Server error" });
    }
});

ContactRouter.get("/", checkPermission("_customer_inquiries_", "get"), async (req, res) => {
    try {
        // Fetch contacts, latest first
        const contacts = await Contact.find()
            .sort({ createdAt: -1 })
            .populate({
                path: "query",
                select: "country city regionName flag"
            })
            .lean();

        return res.status(200).json({
            success: true,
            message: "Customer Inquiries fetched successfully",
            data: contacts
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

ContactRouter.put("/:id", checkPermission("_customer_inquiries_", "put"), async (req, res) => {
    try {
        const contactId = req.params.id;
        const updateData = req.body;

        const contactDet = await Contact.findOne({ _id: contactId });
        if (!contactDet) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }


        const updatedContact = await Contact.findByIdAndUpdate(
            contactDet._id,
            updateData,
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: "Contact updated successfully",
            data: updatedContact
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
});

ContactRouter.delete("/:id", checkPermission("_customer_inquiries_", "delete"), async (req, res) => {
    try {
        const contactId = req.params.id;

        const deletedContact = await Contact.findByIdAndDelete(contactId);

        if (!deletedContact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Contact deleted successfully",
            data: deletedContact
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
});

export default ContactRouter;