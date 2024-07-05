const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
    console.log("==================================");

  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
