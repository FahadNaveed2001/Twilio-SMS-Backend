const User = require("../models/usermodel");


const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({
          status: "success",
          success: true,
          message: "Twilio users fetched successfully",
          Users: users,
        });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({
          status: "error",
          error: error.message,
          message: "Failed to fetch users",
        });
      }
};

module.exports = { getUsers };
