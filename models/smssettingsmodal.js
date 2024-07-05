const mongoose = require("mongoose");

const smsSettingsScehma = new mongoose.Schema({
  textMessage: {
    type: String,
    required: true,
  },
 days: {
  type: Number,
  required: true
 },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

const smsSettings = mongoose.model("Twilio-SMS-settings", smsSettingsScehma);
module.exports = smsSettings;
