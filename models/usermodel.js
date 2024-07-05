const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['Answered', 'Pending', 'Failed'],
    // default: 'Pending',
  },
  numberOfCall: {
    type: Number,
    required: true,
    default: 1,
  },
  lastCalledAt: {
    type: Date,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

const User = mongoose.model("Twilio-User", userSchema);
module.exports = User;