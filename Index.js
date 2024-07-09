//dep imports
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const twilio = require('twilio');
const bodyParser = require('body-parser');
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");

//files imports
const connectDB = require("./config/mongoconnection");
const {
  verifyToken,
  routesWithoutToken,
} = require("./middlewares/authmiddleware");
const { userLogin } = require("./userroutes/userlogin");
const User = require("./models/usermodel");
const { getUsers } = require("./userroutes/getusers");
const { getGroupNames } = require("./userroutes/getgroupnames");

//app and port
const app = express();
const PORT = process.env.PORT || 8000;

//db connection
connectDB();



////
app.use(
  cors({
    origin: [
      "*",
      "https://zap70.com",
      "http://localhost:3000",
      "http://167.71.95.212:3000",
      "http://165.232.134.133:3000",
    ],
    credentials: true,
  })
);
const upload = multer({ dest: "uploads/" });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//middlewares
app.use((req, res, next) => {
  if (routesWithoutToken.includes(req.path)) {
    next();
  } else {
    verifyToken(req, res, next);
  }
});

//root route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    success: true,
    message: "Twilio Server is running!",
  });
  console.log("Root route accessed");
});

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.post("/upload-excel", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const { listName } = req.body;
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: 1
    });
    jsonData = jsonData.map(row => {
      return {
        firstName: row[0],
        lastName: row[1],
        phoneHome: row[3],
        phoneOne: row[2],
        phoneTwo: row[4],
        phoneThree: row[5],
        phoneFour: row[6],
        phoneFive: row[7],
        homeAddress: row[8],
        state: row[9],
        postalAddress: row[10],
        groupName: listName, 
      };
    });

    const users = await User.insertMany(jsonData);
    fs.unlinkSync(filePath);
    res.status(200).json({
      status: "success",
      message: "User saved successfully",
      data: users,
    });
  } catch (error) {
    console.error(`Failed to save users:`, error);
    res.status(500).json({
      status: "error",
      message: "Failed to save users",
      error: error.message,
    });
  }
});


const getUserPhone = async (groupName, numberOfUsers) => {
  try {
    const users = await User.find({ groupName: groupName })
      .sort({ numberOfMessages: 1 })
      .limit(numberOfUsers);

    const phoneNumbers = users.map(user => ({
      userId: user._id,
      phoneHome: user.phoneHome,
      phoneOne: user.phoneOne,
      phoneTwo: user.phoneTwo,
      phoneThree: user.phoneThree,
      phoneFour: user.phoneFour,
      phoneFive: user.phoneFive
    }));

    console.log(phoneNumbers);
    return phoneNumbers;
  } catch (error) {
    console.error("Error fetching phone numbers:", error);
    throw new Error("Failed to fetch phone numbers");
  }
};

app.post("/send-sms", async (req, res) => {
  const { smsText, groupName } = req.body; 
  try {
    if (!smsText || !groupName) {
      throw new Error("SMS text and groupName are required");
    }
    const phoneNumbers = await getUserPhone(groupName); 
    for (const userPhones of phoneNumbers) {
      let smsSent = false;
      for (const phoneKey of Object.keys(userPhones)) {
        const phoneNumber = userPhones[phoneKey];
        if (phoneKey === "userId" || !phoneNumber) continue;
        try {
          const smsMessage = await twilioClient.messages.create({
            body: smsText,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
          });
          console.log(`SMS sent to ${phoneNumber} for user ${userPhones.userId}:`, smsMessage.sid);
          await User.updateOne(
            { _id: userPhones.userId },
            {
              $set: { lastMessagedAt: new Date() },
              $inc: { numberOfMessages: 1 }
            }
          );
          smsSent = true;
          break;
        } catch (error) {
          console.error(`Failed to send SMS to ${phoneNumber} for user ${userPhones.userId}:`, error);
        }
      }

      if (!smsSent) {
        console.warn(`Failed to send SMS to all numbers for user ${userPhones.userId}`);
        await User.updateOne({ _id: userPhones.userId }, { status: "Failed" });
        continue;
      }
    }

    res.status(200).json({
      status: "success",
      message: "SMS sending process completed",
    });
  } catch (error) {
    console.error("Failed to send SMS:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send SMS",
      error: error.message,
    });
  }
});

app.post('/incoming-sms', async (req, res) => {
  const { From, Body } = req.body;
  try {
    if (!From || !Body) {
      throw new Error("From and Body are required fields");
    }
    const normalizedPhoneNumber = From.replace('+', '');
    const user = await User.findOne({
      $or: [
        { phoneHome: normalizedPhoneNumber },
        { phoneOne: normalizedPhoneNumber },
        { phoneTwo: normalizedPhoneNumber },
        { phoneThree: normalizedPhoneNumber },
        { phoneFour: normalizedPhoneNumber },
        { phoneFive: normalizedPhoneNumber }
      ]
    });
    if (!user) {
      throw new Error(`User with phone number ${normalizedPhoneNumber} not found`);
    }
    // if (Body.trim().toLowerCase() === "unsubscribe") {
    //   await User.updateOne({ _id: user._id }, { status: "Unsubscribe" });
    //   console.log(`User ${user._id} unsubscribed`);
    // }
    if (["unsubscribe", "stop", "unsub", "out", "s"].includes(Body.trim().toLowerCase())) {
      await User.updateOne({ _id: user._id }, { status: "Unsubscribed" });
      console.log(`User ${user._id} with phone number ${normalizedPhoneNumber} unsubscribed`);
    }
    res.status(200).json({
      status: "success",
      message: "Incoming SMS processed",
    });
  } catch (error) {
    console.error("Failed to process incoming SMS:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process incoming SMS",
      error: error.message,
    });
  }
});

app.post("/admin-login", async (req, res) => {
  userLogin(req, res);
});

app.get("/users", async (req, res) => {
  getUsers(req, res);
});

app.get('/all-groupnames', async (req, res) => {
  getGroupNames(req, res);
});

//server
app.listen(PORT, () => {
  console.log("==================================");
  console.log(`Server is running on port ${PORT}`);
});
