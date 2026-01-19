import Role from "../models/roles.js";
import User from "../models/users.js";
import mongoose from "mongoose";

const checkPermission = (moduleSlug, action) => {
    return async (req, res, next) => {
        try {
            const uid = req.headers.uid;

            if (!uid) {
                return res.status(401).json({ status: false, message: "Unauthorized: No UID" });
            }

            const user = await User.findOne({ uid: uid }).select("role");

            if (!user) {
                return res.status(403).json({ status: false, message: "User not found" });
            }

            // ✅ Get all modules for debugging
            const allModules = await mongoose.model("Module").find({});

            // ✅ Check if the requested module exists
            const requestedModule = await mongoose.model("Module").findOne({
                slug: moduleSlug,
                "status.active": true
            });

            // ✅ Direct permission check without aggregation
            const role = await Role.findById(user.role).populate('permissions.module');

            if (!role) {
                return res.status(403).json({ status: false, message: "Role not found" });
            }

            // ✅ Find permission for the specific module
            const permission = role.permissions.find(perm =>
                perm.module.slug === moduleSlug &&
                perm.module.status.active === true
            );

            if (!permission) {
                return res.status(403).json({
                    status: false,
                    message: `Forbidden: Module '${moduleSlug}' not found or no permission.`
                });
            }

            if (!permission.actions[action]) {
                return res.status(403).json({
                    status: false,
                    message: `Forbidden: No '${action}' permission for your role.`
                });
            }

            console.log("✅ Permission granted!");
            next();
        } catch (err) {
            return res.status(500).json({ status: false, message: "Internal server error" });
        }
    };
};

export default checkPermission;