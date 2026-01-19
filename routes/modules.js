import express from "express";
import Module from "../models/modules.js";
import checkPermission from "../middlewares/checkRole.js";

const ModuleRouter = express.Router();

ModuleRouter.post("/", checkPermission("_system_settings_", "post"), async (req, res) => {
    try {
        const { name, status, isSystem } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ success: false, message: "Module name is required and must be a non-empty string." });
        }

        if (!status || typeof status !== "object") {
            return res.status(400).json({ success: false, message: "Status is required and must be an object." });
        }

        // Check if module name already exists
        const existing = await Module.findOne({ name: name.trim() });
        if (existing) {
            return res.status(409).json({ success: false, message: "Module with this name already exists." });
        }

        const module = new Module({ name: name.trim(), status, isSystem });
        await module.save();

        res.status(201).json({ success: true, data: module });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

ModuleRouter.get("/", checkPermission("_system_settings_", "get"), async (req, res) => {
    try {
        const modules = await Module.find();
        if (!modules.length) {
            return res.status(404).json({ success: false, message: "No modules found." });
        }

        res.json({ success: true, data: modules });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

ModuleRouter.get("/:uid", checkPermission("_system_settings_", "get"), async (req, res) => {
    try {
        if (!req.params.uid) {
            return res.status(400).json({ success: false, message: "UID is required." });
        }

        const module = await Module.findOne({ uid: req.params.uid });
        if (!module) {
            return res.status(404).json({ success: false, message: "Module not found." });
        }

        res.json({ success: true, data: module });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

ModuleRouter.put("/:uid", checkPermission("_system_settings_", "post"), async (req, res) => {
    try {
        const { name, status, isSystem } = req.body;

        if (!name && !status) {
            return res.status(400).json({ success: false, message: "At least one field (name or status) is required for update." });
        }

        const updateData = {};

        if (name && typeof name === "string" && name.trim()) {
            // Check for duplicate name excluding current module
            const duplicate = await Module.findOne({ name: name.trim(), uid: { $ne: req.params.uid } });
            if (duplicate) {
                return res.status(409).json({ success: false, message: "Another module with this name already exists." });
            }

            updateData.name = name.trim();
            // ✅ also regenerate slug manually here
            const formatted = name.trim().toLowerCase().replace(/\s+/g, "_");
            updateData.slug = `_${formatted}_`;
        }

        if (status && typeof status === "object") {
            updateData.status = status;
        }

        if (isSystem !== undefined) {
            updateData.isSystem = Boolean(isSystem);
        }

        const module = await Module.findOneAndUpdate(
            { uid: req.params.uid },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!module) {
            return res.status(404).json({ success: false, message: "Module not found." });
        }

        res.json({ success: true, data: module });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

ModuleRouter.delete("/:uid", checkPermission("_system_settings_", "delete"), async (req, res) => {
    try {
        if (!req.params.uid) {
            return res.status(400).json({ success: false, message: "UID is required." });
        }

        const module = await Module.findOneAndDelete({ uid: req.params.uid });
        if (!module) {
            return res.status(404).json({ success: false, message: "Module not found." });
        }

        res.json({ success: true, message: "Module deleted successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default ModuleRouter;
