const jwt = require("jsonwebtoken");

const userLogin = (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: true,
        message: "Email and Password are required."
      });
    }

    const predefinedAdminEmail = process.env.ADMIN_EMAIL;
    const predefinedAdminPassword = process.env.ADMIN_PASSWORD;

    if (email === predefinedAdminEmail && password === predefinedAdminPassword) {
      const token = jwt.sign(
        { email: predefinedAdminEmail, role: "admin" },
        process.env.JWT_SECRET_KEY
      );
      res.json({ token, success: true, message: "Login successful as admin" });
      console.log("Admin login done !!");
    } else {
      res.status(401).json({
        error: true,
        message: "The provided Email or Password is invalid."
      });
    }
  } catch (error) {
    res.status(500).json({ error: true, error: error.message, message: "Error Logging In User." });
    console.log("Error Logging In User");
    console.error(error);
  }
};

module.exports = { userLogin };
