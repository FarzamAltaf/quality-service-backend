import express from "express";
import Role from "../models/roles.js";
import Module from "../models/modules.js";
import checkPermission from "../middlewares/checkRole.js";

const RoleManagementRouter = express.Router();

// Get all roles with their permissions (Optimized)
RoleManagementRouter.get('/', checkPermission("_roles_", "get"), async (req, res) => {
    try {
        const roles = await Role.aggregate([
            // Lookup module details first
            {
                $lookup: {
                    from: 'modules',
                    localField: 'permissions.module',
                    foreignField: '_id',
                    as: 'moduleDetails'
                }
            },

            // Add fields to check permissions and valid modules
            {
                $addFields: {
                    permissions: {
                        $map: {
                            input: '$permissions',
                            as: 'perm',
                            in: {
                                moduleIndex: {
                                    $indexOfArray: [
                                        '$moduleDetails._id',
                                        '$$perm.module'
                                    ]
                                },
                                actions: '$$perm.actions',
                                originalPerm: '$$perm'
                            }
                        }
                    }
                }
            },

            // Filter permissions where at least one action is true AND module exists
            {
                $addFields: {
                    permissions: {
                        $filter: {
                            input: '$permissions',
                            as: 'perm',
                            cond: {
                                $and: [
                                    { $ne: ['$$perm.moduleIndex', -1] }, // Module exists
                                    {
                                        $or: [
                                            { $eq: ['$$perm.actions.get', true] },
                                            { $eq: ['$$perm.actions.post', true] },
                                            { $eq: ['$$perm.actions.put', true] },
                                            { $eq: ['$$perm.actions.delete', true] }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },

            // Transform the final structure
            {
                $project: {
                    name: 1,
                    uid: 1,
                    slug: 1,
                    permissions: {
                        $map: {
                            input: '$permissions',
                            as: 'perm',
                            in: {
                                module: {
                                    $arrayElemAt: [
                                        '$moduleDetails',
                                        '$$perm.moduleIndex'
                                    ]
                                },
                                actions: '$$perm.actions'
                            }
                        }
                    }
                }
            },

            // Final projection to clean up module data
            {
                $project: {
                    name: 1,
                    uid: 1,
                    slug: 1,
                    permissions: {
                        $map: {
                            input: '$permissions',
                            as: 'perm',
                            in: {
                                module: {
                                    _id: '$$perm.module._id',
                                    uid: '$$perm.module.uid',
                                    name: '$$perm.module.name',
                                    slug: '$$perm.module.slug',
                                    status: '$$perm.module.status',
                                    isSystem: '$$perm.module.isSystem'
                                },
                                actions: '$$perm.actions'
                            }
                        }
                    }
                }
            },

            // Sort by name
            { $sort: { name: 1 } }
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

// Get all modules for selection
RoleManagementRouter.get('/modules', checkPermission("_roles_", "get"), async (req, res) => {
    try {
        const modules = await Module.find({ 'status.active': true })
            .select('uid name slug status')
            .sort({ name: 1 });

        res.json({
            success: true,
            data: modules,
            message: 'Modules fetched successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching modules',
            error: error.message
        });
    }
});

RoleManagementRouter.get('/admin-modules', checkPermission("_roles_", "get"), async (req, res) => {
    try {
        const modules = await Module.aggregate([
            {
                $match: {
                    'status.active': true,
                    'isSystem': false  // Only non-system modules
                }
            },
            {
                $project: {
                    uid: 1,
                    name: 1,
                    slug: 1,
                    status: 1,
                    isSystem: 1
                }
            },
            {
                $sort: { name: 1 }
            }
        ]);

        res.json({
            success: true,
            data: modules
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching modules',
            error: error.message
        });
    }
});

// Update role permissions (Optimized)
RoleManagementRouter.put('/permissions', checkPermission("_roles_", "put"), async (req, res) => {
    try {
        const { roles } = req.body;

        if (!roles || !Array.isArray(roles)) {
            return res.status(400).json({
                success: false,
                message: 'Roles array is required'
            });
        }

        const updateResults = [];

        for (const roleData of roles) {
            const { roleUid, permissions } = roleData;

            // Validate role exists
            const role = await Role.findOne({ uid: roleUid });
            if (!role) {
                updateResults.push({
                    roleUid,
                    success: false,
                    message: 'Role not found'
                });
                continue;
            }

            // Validate modules and build permissions array
            const validPermissions = [];

            for (const perm of permissions) {
                const module = await Module.findOne({
                    uid: perm.moduleUid,
                    'status.active': true
                });

                if (!module) {
                    updateResults.push({
                        roleUid,
                        success: false,
                        message: `Module not found or inactive: ${perm.moduleUid}`
                    });
                    continue;
                }

                validPermissions.push({
                    module: module._id,
                    actions: {
                        get: Boolean(perm.actions.get),
                        post: Boolean(perm.actions.post),
                        put: Boolean(perm.actions.put),
                        delete: Boolean(perm.actions.delete)
                    }
                });
            }

            // Update role permissions
            role.permissions = validPermissions;
            await role.save();

            updateResults.push({
                roleUid,
                success: true,
                message: 'Permissions updated successfully'
            });
        }

        res.json({
            success: true,
            data: updateResults,
            message: 'Permissions update completed'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating permissions',
            error: error.message
        });
    }
});

// Add new role
RoleManagementRouter.post('/', checkPermission("_roles_", "post"), async (req, res) => {
    try {
        const { name, permissions = [] } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Role name is required'
            });
        }

        const trimmedName = name.trim();

        // Check if role already exists
        const existingRole = await Role.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
        });

        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: 'Role with this name already exists'
            });
        }

        // Validate and build permissions
        const validPermissions = [];

        for (const perm of permissions) {
            const module = await Module.findOne({
                uid: perm.moduleUid,
                'status.active': true
            });

            if (!module) {
                return res.status(400).json({
                    success: false,
                    message: `Module not found or inactive: ${perm.moduleUid}`
                });
            }

            validPermissions.push({
                module: module._id,
                actions: {
                    get: Boolean(perm.actions.get),
                    post: Boolean(perm.actions.post),
                    put: Boolean(perm.actions.put),
                    delete: Boolean(perm.actions.delete)
                }
            });
        }

        const newRole = new Role({
            name: trimmedName,
            permissions: validPermissions
        });

        await newRole.save();

        // Populate the response
        const populatedRole = await Role.findById(newRole._id)
            .populate({
                path: 'permissions.module',
                select: 'uid name slug status'
            });

        res.status(201).json({
            success: true,
            data: populatedRole,
            message: 'Role created successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: error.message
        });
    }
});

export default RoleManagementRouter;