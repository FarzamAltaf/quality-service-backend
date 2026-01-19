import express from "express";
import User from "../models/users.js";
import Visitor from "../models/visitors.js";
import Role from "../models/roles.js"; // Import Role model
import checkPermission from "../middlewares/checkRole.js";

const UserRouter = express.Router();

UserRouter.get('/:userUid/details', checkPermission("_users_", "get"), async (req, res) => {
    try {
        const { userUid } = req.params;

        // Find user by UID
        const user = await User.findOne({ uid: userUid })
            .select('-password -refreshTokens -_id -__v')
            .populate('role', 'name uid _id') // _id بھی include کریں
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find visitor data if query array exists
        let visitors = [];
        if (user.query && user.query.length > 0) {
            visitors = await Visitor.find({
                _id: { $in: user.query }
            }).select('-_id -__v').lean();
        }

        res.json({
            success: true,
            data: {
                user,
                visitors
            },
            message: 'User details fetched successfully'
        });
    } catch (error) {
        console.error('Error in user details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user details',
            error: error.message
        });
    }
});

UserRouter.put('/:userUid', checkPermission("_users_", "put"), async (req, res) => {
    try {
        const { userUid } = req.params;
        const updateData = req.body;

        console.log('Updating user:', userUid, updateData);

        // Find the role by UID to get its ObjectId
        let roleObjectId = null;
        if (updateData.role) {
            // یہاں role کو UID سے تلاش کریں
            const role = await Role.findOne({ uid: updateData.role }).select('_id');
            if (role) {
                roleObjectId = role._id;
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }
        }

        // Build update object
        const updateFields = {
            username: updateData.username,
            phone: updateData.phone,
            subscribed: updateData.subscribed,
        };

        // Add role if it exists
        if (roleObjectId) {
            updateFields.role = roleObjectId;
        }

        // Add access fields if they exist
        if (updateData.access) {
            updateFields['access.active'] = updateData.access.active;
            updateFields['access.suspend'] = updateData.access.suspend;
        }

        console.log('Final update fields:', updateFields);

        // Find user by UID and update
        const updatedUser = await User.findOneAndUpdate(
            { uid: userUid },
            { $set: updateFields },
            {
                new: true,
                runValidators: true,
                context: 'query'
            }
        )
            .select('-password -refreshTokens -_id -__v')
            .populate('role', 'name uid _id'); // _id بھی include کریں

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('User updated successfully:', updatedUser.username);

        res.json({
            success: true,
            data: updatedUser,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
});

export default UserRouter;