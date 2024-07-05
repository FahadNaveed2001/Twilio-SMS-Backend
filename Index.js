//dep imports
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const twilio = require('twilio');
const axios = require('axios');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const cron = require('node-cron');


//files imports
const connectDB = require("./config/mongoconnection");
const {
  verifyToken,
  routesWithoutToken,
} = require("./middlewares/authmiddleware");
const { userLogin } = require("./userroutes/userlogin");
const User = require("./models/usermodel");
// const Settings = require("./models/smssettingsmodal");
const smsSettings = require("./models/smssettingsmodal");
const callSettings = require("./models/callsettingsmodel");
const callDaysSettings = require("./models/dayscountermodal");
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




// app.post("/api/make-call", async (req, res) => {
//   try {
//     const { phoneNumber } = req.body;
//     if (!phoneNumber) {
//       return res.status(400).json({
//         status: "error",
//         message: "Phone number dalo",
//       });
//     }

//     try {
//       const call = await client.calls.create({
//         from: process.env.TWILIO_PHONE_NUMBER,
//         to: phoneNumber,
//         url: "http://demo.twilio.com/docs/voice.xml",
//         statusCallback: "https://431c-154-192-30-63.ngrok-free.app/callstatus",
//         statusCallbackMethod: "POST",
//         statusCallbackEvent: ['answered', 'ringing', 'completed'],
//       });
//       console.log("Call initiated:", call.sid);
//       res.status(200).json({
//         status: "success",
//         message: "Call initiated successfully",
//         callSid: call.sid,
//       });
//     } catch (error) {
//       console.error(`Failed to make call to ${phoneNumber}:`, error);
//       res.status(500).json({
//         status: "error",
//         message: `Failed to make call to ${phoneNumber}`,
//         error: error.message,
//       });
//     }
//   } catch (error) {
//     console.error("Error processing request:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to process request",
//       error: error.message,
//     });
//   }
// });

const getUserPhone = async (numberOfUsers) => {
  try {
    const users = await User.find({ status: "Pending" }, "phone numberOfCall -_id")
      .sort({ numberOfCall: 1 })
      .limit(numberOfUsers);

    const phoneNumbers = users.map(user => user.phone);
    console.log(phoneNumbers);
    return phoneNumbers;
  } catch (error) {
    console.error("Error fetching phone numbers:", error);
    throw new Error("Failed to fetch phone numbers");
  }
};

app.post("/send-sms", async (req, res) => {
  const { toNumber } = req.body;

  try {
    // const currentDay = moment().startOf('day');
    const settings = await smsSettings.findOne({ days: 4 });
    if (!settings) {
      throw new Error(`SMS not found for day ${currentDay}`);
    }
    const smsMessage = await twilioClient.messages.create({
      body: settings.textMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toNumber
    });
    console.log(`SMS sent to ${toNumber}:`, smsMessage.sid);
    res.status(200).json({
      status: "success",
      message: `SMS sent successfully to ${toNumber}`,
      data: smsMessage,
    });
  } catch (error) {
    console.error(`Failed to send SMS to ${toNumber}:`, error);
    res.status(500).json({
      status: "error",
      message: `Failed to send SMS to ${toNumber}`,
      error: error.message,
    });
  }
});

app.post("/callstatus", async (req, res) => {
  const callStatus = req.body.CallStatus;
  const toNumber = req.body.To;

  if (["in-progress", "answered"].includes(callStatus)) {
    await User.updateOne({ phone: toNumber }, { $set: { status: "Answered" } });
    console.log(`Updated status to Answered for user with phone number ${toNumber}`);
  } else if (["no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
    try {
      const updatedUser = await User.findOneAndUpdate(
        { phone: toNumber },
        { $inc: { numberOfCall: 1 } },
        { new: true }
      );
      console.log(`Incremented number of calls for user with phone number ${toNumber}`);
      const smsToSend = await smsSettings.findOne({ days: updatedUser.numberOfCall });
      if (!smsToSend) {
        await User.updateOne({ phone: toNumber }, { $set: { status: "Failed" } });
        console.log(`No SMS settings found for day ${updatedUser.numberOfCall}. Updated status to Failed for user with phone number ${toNumber}`);
        throw new Error(`No SMS settings found for day ${updatedUser.numberOfCall}`);
      }
      const smsMessage = await twilioClient.messages.create({
        body: smsToSend.textMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      });
      console.log(`SMS sent to ${toNumber}:`, smsMessage.sid);

    } catch (error) {
      console.error(`Failed to increment number of calls or send SMS to ${toNumber}:`, error);
    }
  } else if (callStatus === "completed" || callStatus === "ringing") {
  }

  res.status(200).send('Status received and completed task');
});




const getLastCalledAt = async (phoneNumber) => {
  const user = await User.findOne({ phone: phoneNumber });
  return user ? user.lastCalledAt : null;
};

const updateLastCalledAt = async (phoneNumber, timestamp) => {
  await User.updateOne({ phone: phoneNumber }, { lastCalledAt: timestamp });
};

// app.post("/api/make-call", async (req, res) => {
//   try {
//     const numberOfUsers = req.body.numberOfUsers;
//     if (!numberOfUsers || numberOfUsers <= 0) {
//       return res.status(400).json({
//         status: "error",
//         message: "Invalid numberOfUsers provided",
//       });
//     }
//     const phoneNumbers = await getUserPhone(numberOfUsers);
//     if (phoneNumbers.length < numberOfUsers) {
//       return res.status(400).json({
//         status: "error",
//         message: `Not enough pending users found. Reduce numberOfUsers or try again later.`,
//       });
//     }
//     console.log(`Phone numbers to call (fetching ${numberOfUsers} users):`, phoneNumbers);

//     const results = [];
//     const currentHourET = moment().tz('America/New_York').hour();

//     for (let i = 0; i < phoneNumbers.length; i++) {
//       const phoneNumber = phoneNumbers[i];

//       if (currentHourET < 9 || currentHourET >= 17) {
//         console.log(`Current time is ${currentHourET} - call for ${phoneNumber} will be skipped.`);
//         results.push({
//           phoneNumber: phoneNumber,
//           status: "skipped",
//           message: "Call skipped due to outside calling hours (9 AM - 5 PM ET)",
//         });
//       } else {
//         try {
//           const call = await client.calls.create({
//             from: process.env.TWILIO_PHONE_NUMBER,
//             to: phoneNumber.toString(),
//             url: "http://demo.twilio.com/docs/voice.xml",
//             statusCallback: "https://c944-154-192-74-22.ngrok-free.app/callstatus",
//             statusCallbackMethod: "POST",
//             statusCallbackEvent: ['answered', 'ringing', 'completed'],
//           });

//           console.log(`Call initiated successfully to ${phoneNumber}. Call SID: ${call.sid}`);
//           await updateLastCalledAt(phoneNumber, Date.now()); 
//           await new Promise(resolve => setTimeout(resolve, 5000));
//           const callDetails = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls/${call.sid}.json`, {
//             auth: {
//               username: process.env.TWILIO_ACCOUNT_SID,
//               password: process.env.TWILIO_AUTH_TOKEN,
//             },
//           });

//           results.push({
//             phoneNumber: phoneNumber,
//             status: "success",
//             message: "Call initiated successfully",
//             callDetails: callDetails.data,
//           });

//         } catch (error) {
//           console.error(`Failed to make call to ${phoneNumber}:`, error);
//           results.push({
//             phoneNumber: phoneNumber,
//             status: "error",
//             message: `Failed to make call to ${phoneNumber}`,
//             error: error.message,
//           });
//         }
//       }
//     }

//     res.status(200).json({
//       status: "success",
//       results: results,
//     });

//   } catch (error) {
//     console.error("Error making calls:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to make calls",
//       error: error.message,
//     });
//   }
// });

app.post("/api/make-call", async (req, res) => {
  try {
    const numberOfUsers = req.body.numberOfUsers;
    if (!numberOfUsers || numberOfUsers <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid numberOfUsers provided",
      });
    }
    const phoneNumbers = await getUserPhone(numberOfUsers);
    if (phoneNumbers.length < numberOfUsers) {
      return res.status(400).json({
        status: "error",
        message: `Not enough pending users found. Reduce numberOfUsers or try again later.`,
      });
    }
    console.log(`Phone numbers to call (fetching ${numberOfUsers} users):`, phoneNumbers);

    const results = [];
    const currentHourET = moment().tz('America/New_York').hour();

    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      const lastCalledAt = await getLastCalledAt(phoneNumber);
      if (lastCalledAt && moment().diff(moment(lastCalledAt), 'hours') < 24) {
        results.push({
          phoneNumber: phoneNumber,
          status: "skipped",
          message: "User has already been called today",
        });
        continue;
      }

      if (currentHourET < 9 || currentHourET >= 17) {
        console.log(`Current time is ${currentHourET} - call for ${phoneNumber} will be skipped.`);
        results.push({
          phoneNumber: phoneNumber,
          status: "skipped",
          message: "Call skipped due to outside calling hours (9 AM - 5 PM ET)",
        });
      } else {
        try {
          const requestData = {};

          const call = await client.calls.create({
            twiml: `
       <Response>
    <Gather numDigits="1" action="https://1319-154-192-74-82.ngrok-free.app/gather?requestData=${encodeURIComponent(JSON.stringify(requestData))}" method="POST">
      <Say>Hello, and thank you for your interest in receiving a quote from National Health Quote. Now, please press 1 or say "request a quote." If you are 64 years of age or older, press 2 or say "Medicare".</Say>
    </Gather>
  </Response>
            `,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber.toString(),
            statusCallback: "https://1319-154-192-74-82.ngrok-free.app/callstatus",
            statusCallbackMethod: "POST",
            statusCallbackEvent: ['answered', 'ringing', 'completed'],
          });

          console.log(`Call initiated successfully to ${phoneNumber}. Call SID: ${call.sid}`);
          await updateLastCalledAt(phoneNumber, Date.now());
          await new Promise(resolve => setTimeout(resolve, 5000));
          const callDetails = await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls/${call.sid}.json`, {
            auth: {
              username: process.env.TWILIO_ACCOUNT_SID,
              password: process.env.TWILIO_AUTH_TOKEN,
            },
          });

          results.push({
            phoneNumber: phoneNumber,
            status: "success",
            message: "Call initiated successfully",
            callDetails: callDetails.data,
          });

        } catch (error) {
          console.error(`Failed to make call to ${phoneNumber}:`, error);
          results.push({
            phoneNumber: phoneNumber,
            status: "error",
            message: `Failed to make call to ${phoneNumber}`,
            error: error.message,
          });
        }
      }
    }

    res.status(200).json({
      status: "success",
      results: results,
    });

  } catch (error) {
    console.error("Error making calls:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to make calls",
      error: error.message,
    });
  }
});

app.post("/gather", async (req, res) => {
  try {
    const toNumber = req.body.To;
    const digits = req.body.Digits;
    console.log("Digits fetched:", digits);
    console.log("To number fetched:", toNumber);

    let twimlResponse;

    if (digits === '1') {
      twimlResponse = `
        <Response>
          <Dial>923495621386</Dial>
        </Response>`;
      const smsMessage = await twilioClient.messages.create({
        body: "you have pressed button 1 thankyou",
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      });
      console.log("SMS sent:", smsMessage.sid);
    } else if (digits === '2') {
      twimlResponse = `
        <Response>
          <Dial>923495621386</Dial>
        </Response>`;
      const smsMessage = await twilioClient.messages.create({
        body: "you have pressed button 2 thankyou",
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      });
      console.log("SMS sent:", smsMessage.sid);
    } else {
      twimlResponse = `
        <Response>
          <Say>I think you have not pressed any button Thanks for picking the call. Goodbye!</Say>
        </Response>`;
      const smsMessage = await twilioClient.messages.create({
        body: "Thank you for answering the call. If you have any questions or need assistance, please feel free to reach out to us at your convenience.",
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toNumber
      });
      console.log("SMS sent:", smsMessage.sid);
    }

    res.set('Content-Type', 'text/xml');
    res.send(twimlResponse);
  } catch (error) {
    console.error("Error handling gather input:", error);
    res.status(500).json({
      message: "Error handling gather input",
      error: error.message
    });
  }
});


// app.post("/gather", async (req, res) => {
//   try {
//     const digits = req.body.Digits;
//     const requestData = JSON.parse(req.query.requestData);

//     if (!digits) {
//       return res.status(400).send('<Response><Say>No input received. Goodbye!</Say></Response>');
//     }

//     let responseMessage;
//     let targetNumber;
//     switch (digits) {
//       case '1':
//         responseMessage = 'You selected to request a quote. Please stay on the line for further assistance.';
//         targetNumber = '923495621386';
//         break;
//       case '2':
//         responseMessage = 'You selected Medicare. Please stay on the line for further assistance.';
//         targetNumber = '923495621386';
//         break;
//       default:
//         responseMessage = 'Invalid input. Goodbye!';
//         break;
//     }

//     if (targetNumber) {
//       try {
//         const call = await client.calls.create({
//           twiml: `
//           <Response>
//             <Say>${responseMessage}</Say>
//           </Response>
//           `,
//           from: process.env.TWILIO_PHONE_NUMBER,
//           to: targetNumber,
//         });

//         console.log(`Call initiated successfully to ${targetNumber}. Call SID: ${call.sid}`);
//       } catch (error) {
//         console.error(`Failed to make call to ${targetNumber}:`, error);
//       }
//     }

//     res.set('Content-Type', 'text/xml');
//     res.send(`
//       <Response>
//         <Say>${responseMessage}</Say>
//       </Response>
//     `);
//   } catch (error) {
//     console.error("Error handling gather input:", error);
//     res.status(500).send(`
//       <Response>
//         <Say>Sorry, an error occurred while processing your request. Please try again later. Goodbye!</Say>
//       </Response>
//     `);
//   }
// });



app.get("/numbers", async (req, res) => {
  try {
    const phoneNumbers = await getUserPhone();
    res.status(200).json({
      status: "success",
      phoneNumbers: phoneNumbers,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

//admin login route
app.post("/admin-login", async (req, res) => {
  userLogin(req, res);
});


app.post("/add-user", async (req, res) => {
  try {
    const { phone, status } = req.body;
    let existingUser = await User.findOne({ phone });
    if (existingUser) {
      existingUser.status = status;
      existingUser.numberOfCall += 1;
      existingUser.date = Date.now();
      await existingUser.save();
      res.status(200).json({
        status: "success",
        success: true,
        message: "User updated successfully",
        data: existingUser,
      });
    } else {
      const newUser = new User({
        phone,
        status,
        numberOfCall: 0,
        date: Date.now(),
      });
      await newUser.save();
      res.status(201).json({
        status: "success",
        success: true,
        message: "User added successfully",
        data: newUser,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Internal server Eoor",
    });
  }
});

app.get("/users", async (req, res) => {
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
});

app.get("/pending-users", async (req, res) => {
  try {
    const pendingUsersCount = await User.countDocuments({ status: "Pending" });
    res.status(200).json({
      status: "success",
      success: true,
      message: "Pending users fetched successfully",
      Users: pendingUsersCount,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to fetch users",
    });
  }
});



const updateCallDaysSettings = async () => {
  try {
    const count = await smsSettings.countDocuments();
    let existingSetting = await callDaysSettings.findOne({});
    if (existingSetting) {
      existingSetting.numberOfDaysToCalls = count;
      await existingSetting.save();
    } else {
      const newSetting = new callDaysSettings({
        numberOfDaysToCalls: count,
      });
      await newSetting.save();
    }
    // console.log(`${count}`);
  } catch (error) {
    console.error(error);
  }
};

app.post("/api/add-sms", async (req, res) => {
  try {
    const { textMessage } = req.body;
    const count = await smsSettings.countDocuments();
    const newSettings = new smsSettings({
      textMessage,
      days: count + 1,
    });
    await newSettings.save();
    res.status(201).json({
      status: "success",
      success: true,
      message: "Settings added successfully",
      data: newSettings,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to add Settings",
    });
  }
});

app.put("/api/update-sms/:id", async (req, res) => {
  const { id } = req.params;
  const { textMessage } = req.body;
  try {
    let settings = await smsSettings.findById(id);
    if (!settings) {
      return res.status(404).json({
        status: "error",
        message: "SMS settings not found",
      });
    }
    settings.textMessage = textMessage;
    await settings.save();

    res.status(200).json({
      status: "success",
      message: "SMS settings updated successfully",
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to update SMS settings",
    });
  }
});

app.get("/api/sms", async (req, res) => {
  try {
    const users = await smsSettings.find();
    res.status(200).json({
      status: "success",
      success: true,
      message: "Twilio Settings fetched successfully",
      Settings: users,
    });
    await updateCallDaysSettings();

  } catch (error) {
    // console.error("Error fetching users:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to fetch Settings",
    });
  }
});

app.delete("/api/sms/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedSetting = await smsSettings.findByIdAndDelete(id);
    if (!deletedSetting) {
      return res.status(404).json({
        status: "error",
        message: "SMS not found",
      });
    }
    res.status(200).json({
      status: "success",
      message: "SMS deleted successfully",
      // deletedSetting: deletedSetting,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to delete SMS",
    });
  }
});

app.post("/api/add-call", async (req, res) => {
  try {
    const { numberOfCallsPerHour } = req.body;
    const pendingUsersCount = await User.countDocuments({ status: 'Pending' });
    if (numberOfCallsPerHour > pendingUsersCount) {
      return res.status(400).json({
        status: "error",
        message: "Not enough pending users to add this number of calls",
        pendingUsersCount: pendingUsersCount,
      });
    }
    await callSettings.findOneAndDelete({});
    const newSettings = new callSettings({
      numberOfCallsPerHour: numberOfCallsPerHour,
    });
    await newSettings.save();

    res.status(201).json({
      status: "success",
      success: true,
      message: `Number of calls (${numberOfCallsPerHour}) added successfully.`,
      data: newSettings,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to add number of calls",
    });
  }
});

app.get("/api/call", async (req, res) => {
  try {
    const users = await callSettings.find();
    res.status(200).json({
      status: "success",
      success: true,
      message: "Twilio Call Settings fetched successfully",
      Settings: users,
    });
  } catch (error) {
    // console.error("Error fetching users:", error);
    res.status(500).json({
      status: "error",
      error: error.message,
      message: "Failed to fetch call Settings",
    });
  }
});

// app.post("/log-data", (req, res) => {
//   console.log("Received data:", req.body);
//   res.status(200).json({
//     status: "success",
//     success: true,
//     message: "Data received and logged successfully",
//     data: req.body,
//   });
// });

// cron.schedule('*/3 * * * *', async () => {
//   try {
//     const { numberOfCallsPerHour } = await getCallSettings();
//     const response = await axios.post('http://localhost:8000/api/make-call', {
//       numberOfUsers: numberOfCallsPerHour,
//     });
//     console.log('Cron job executed successfully:', response.data);
//   } catch (error) {
//     console.error('Error running cron job:', error);
//   }
// });

const getCallSettings = async () => {
  try {
    const settings = await callSettings.findOne();
    if (!settings) {
      throw new Error('Call settings not found in database');
    }
    return settings;
  } catch (error) {
    throw new Error(`Failed to fetch call settings: ${error.message}`);
  }
};




//server
app.listen(PORT, () => {
  console.log("==================================");
  console.log(`Server is running on port ${PORT}`);
});
