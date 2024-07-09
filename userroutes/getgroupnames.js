const User = require("../models/usermodel");


const getGroupNames = async (req, res) => {
    try {
        const users = await User.find({});
        const groupNames = users.map(user => user.groupName);
        const uniqueGroupNames = [...new Set(groupNames)];
        res.status(200).json({
          status: 'success',
          uniqueGroupNames,
        });
     } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
          status: 'error',
          message: 'Internal server error',
          error: error.message,
   });
 }
};

module.exports = { getGroupNames };
