import express from "express";
import Defaults from "../models/defaults.js";
import Role from "../models/roles.js";
import User from "../models/users.js";
import checkPermission from "../middlewares/checkRole.js";

const DefaultsRouter = express.Router();

DefaultsRouter.post("/role/", checkPermission("_system_settings_", "post"), async (req, res) => {
    const { roleId } = req.body;
    const name = "Role";

    if (!roleId) {
        return res.status(400).json({ status: false, message: "Role is required" });
    }

    try {
        const roleExists = await Role.findById(roleId);
        if (!roleExists) {
            return res.status(404).json({ status: false, message: "Role not found" });
        }

        const defaultsExist = await Defaults.findOne({ prior: name });
        if (defaultsExist) {
            return res.status(400).json({ status: false, message: "Default Role Already Available" });
        }

        const newDefault = new Defaults({ prior: name, roleId });
        const savedDefaults = await newDefault.save();

        return res.status(200).json({ status: true, data: savedDefaults });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: e.message
        });
    }
});

DefaultsRouter.get("/role/", checkPermission("_system_settings_", "get"), async (req, res) => {
    const name = "Role";

    try {
        const defaultRole = await Defaults.findOne({ prior: name }).populate("roleId");

        if (!defaultRole) {
            return res.status(404).json({
                status: false,
                message: "No default role set",
                data: null
            });
        }

        return res.status(200).json({
            status: true,
            data: defaultRole
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: e.message
        });
    }
});

DefaultsRouter.put("/role/", checkPermission("_system_settings_", "put"), async (req, res) => {
    const { roleId } = req.body;
    const name = "Role";


    if (!roleId) {
        return res.status(400).json({ status: false, message: "Role is required" });
    }

    try {
        const roleExists = await Role.findOne({ uid: roleId });
        if (!roleExists) {
            return res.status(404).json({ status: false, message: "Role not found" });
        }

        const defaultRole = await Defaults.findOne({ prior: name });

        if (!defaultRole) {
            return res.status(404).json({
                status: false,
                message: "Default role not found. Use POST to create one."
            });
        }

        // Update the roleId
        defaultRole.roleId = roleExists._id;
        const updatedDefault = await defaultRole.save();

        return res.status(200).json({
            status: true,
            message: "Default role updated successfully",
            data: updatedDefault
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: e.message
        });
    }
});

DefaultsRouter.put("/theme", async (req, res) => {
    try {
        const { uid } = req.headers;
        const { theme } = req.body;

        // Validate UID
        if (!uid) {
            return res.status(400).json({ success: false, message: "UID header missing." });
        }


        // Update the user's theme
        const updatedUser = await User.findOneAndUpdate(
            { uid: uid },
            { $set: { theme } },
            { new: true, projection: { password: 0, refreshTokens: 0 } } // exclude sensitive data
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        res.status(200).json({
            success: true,
            message: "Theme updated successfully.",
            user: updatedUser,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message,
        });
    }
});

export default DefaultsRouter;
