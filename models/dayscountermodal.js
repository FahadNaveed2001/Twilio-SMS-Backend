const mongoose = require("mongoose");

const dayCounterScehma = new mongoose.Schema({
  numberOfDaysToCalls: {
    type: Number,
    required: true,
  },
});

const callDaysSettings = mongoose.model("Twilio-Call-days-settings", dayCounterScehma);
module.exports = callDaysSettings;
