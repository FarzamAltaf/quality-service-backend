import express from "express";
import Role from "../models/roles.js";
import Module from "../models/modules.js";
import checkPermission from "../middlewares/checkRole.js";
import mongoose from "mongoose"; // Add this import

const RoleRouter = express.Router();

// Create new role
RoleRouter.post("/", checkPermission("_roles_", "post"), async (req, res) => {
    const { name, permissions = [] } = req.body;

    if (!name) {
        return res.status(400).json({ status: false, message: "Name is required" });
    }

    // Case-insensitive check
    const roleExist = await Role.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    if (roleExist) {
        return res.status(400).json({ status: false, message: "Role Already Available" });
    }

    // Validate and transform permissions
    const validPermissions = [];

    for (const perm of permissions) {
        // Module UID se Module find karein
        const moduleExist = await Module.findOne({ uid: perm.moduleUid });
        if (!moduleExist) {
            return res.status(400).json({
                status: false,
                message: `Module not found: ${perm.moduleUid}`
            });
        }

        const actions = perm.actions;
        if (!actions || typeof actions !== "object") {
            return res.status(400).json({
                status: false,
                message: `Actions must be an object with get/post/put/delete for module ${perm.moduleUid}`
            });
        }

        const validKeys = ["get", "post", "put", "delete"];
        const hasAllKeys = validKeys.every(k => k in actions);
        if (!hasAllKeys) {
            return res.status(400).json({
                status: false,
                message: `Actions must include get, post, put, delete for module ${perm.moduleUid}`
            });
        }

        // Transform to backend format
        validPermissions.push({
            module: moduleExist._id,  // ObjectId use karein
            actions: {
                get: Boolean(actions.get),
                post: Boolean(actions.post),
                put: Boolean(actions.put),
                delete: Boolean(actions.delete)
            }
        });
    }

    try {
        const newRole = new Role({
            name: name.trim(),
            permissions: validPermissions
        });
        const savedRole = await newRole.save();

        // Populate the response for better frontend experience
        const populatedRole = await Role.findById(savedRole._id)
            .populate({
                path: 'permissions.module',
                select: 'uid name slug status'
            });

        return res.status(201).json({
            status: true,
            data: populatedRole,
            message: "Role created successfully"
        });
    } catch (e) {
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: e.message
        });
    }
});


RoleRouter.get('/', checkPermission("_roles_", "get"), async (req, res) => {
    try {
        const roles = await Role.aggregate([
            {
                $project: {
                    _id: 1,
                    name: 1,
                    uid: 1
                }
            },
            {
                $sort: { name: 1 }
            }
        ]);

        res.json({
            success: true,
            data: roles,
            message: 'Roles fetched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: error.message
        });
    }
});


// Delete role by UID (main delete endpoint)
RoleRouter.delete('/:roleUid', checkPermission("_roles_", "delete"), async (req, res) => {
    try {
        const { roleUid } = req.params;

        // Find role by UID
        const role = await Role.findOne({ uid: roleUid });
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Check if this is a default role that shouldn't be deleted
        const defaultRoles = ['admin', 'superadmin', 'user'];
        if (defaultRoles.includes(role.name.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete default role: ${role.name}`
            });
        }

        // Check if any users are assigned to this role
        const User = mongoose.model('User');
        const usersWithRole = await User.countDocuments({ role: role._id });

        if (usersWithRole > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role. ${usersWithRole} user(s) are assigned to this role.`
            });
        }

        // Delete the role
        await Role.findByIdAndDelete(role._id);

        res.json({
            success: true,
            message: 'Role deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
});

// Force delete endpoint (without user check)
RoleRouter.delete('/:roleUid/force', checkPermission("_roles_", "delete"), async (req, res) => {
    try {
        const { roleUid } = req.params;

        // Find role by UID
        const role = await Role.findOne({ uid: roleUid });
        if (!role) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Check if this is a default role that shouldn't be deleted
        const defaultRoles = ['admin', 'superadmin', 'user'];
        if (defaultRoles.includes(role.name.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete default role: ${role.name}`
            });
        }

        // Force delete the role
        await Role.findByIdAndDelete(role._id);

        res.json({
            success: true,
            message: 'Role force deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
});

// Get users by role UID (using aggregation)
RoleRouter.get('/:roleUid/users', checkPermission("_roles_", "get"), async (req, res) => {
    try {
        const { roleUid } = req.params;

        const result = await Role.aggregate([
            {
                $match: { uid: roleUid }
            },
            {
                $lookup: {
                    from: 'users',
                    let: { roleId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$role', '$$roleId'] }
                            }
                        },
                        {
                            $lookup: {
                                from: 'roles',
                                localField: 'role',
                                foreignField: '_id',
                                as: 'roleDetails'
                            }
                        },
                        {
                            $unwind: {
                                path: '$roleDetails',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                username: 1,
                                email: 1,
                                phone: 1,
                                profile_pic: 1,
                                uid: 1,
                                subscribed: 1,
                                lastLoginAt: 1,
                                timeAdded: 1,
                                access: 1,
                                role: {
                                    _id: '$roleDetails._id',
                                    name: '$roleDetails.name',
                                    uid: '$roleDetails.uid'
                                }
                            }
                        },
                        {
                            $sort: { username: 1 }
                        }
                    ],
                    as: 'users'
                }
            },
            {
                $project: {
                    _id: 1,
                    role: {
                        name: '$name',
                        uid: '$uid'
                    },
                    users: 1
                }
            }
        ]);

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        res.json({
            success: true,
            data: result[0],
            message: 'Users fetched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching users by role',
            error: error.message
        });
    }
});

export default RoleRouter;