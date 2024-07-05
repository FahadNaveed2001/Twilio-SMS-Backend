const mongoose = require("mongoose");

const callSettingsScehma = new mongoose.Schema({
  numberOfCallsPerHour: {
    type: Number,
    required: true,
  },
});

const callSettings = mongoose.model("Twilio-Call-settings", callSettingsScehma);
module.exports = callSettings;
