const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName:{
    type: String,
  },
  lastName:{
    type: String,
  },
  phoneHome: {
    type: String,
  },
  phoneOne: {
    type: String,
  },
  phoneTwo: {
    type: String,
  },
  phoneThree: {
    type: String,
  },
  phoneFour: {
    type: String,
  },
  phoneFive: {
    type: String,
  },
  homeAddress:{
    type: String,
  },
  state:{
    type: String,
  },
  postalAddress:{
    type: Number,
  },
  groupName:{
    type: String,
  },
  status: {
    type: String,
    // required: true,
    enum: ['Pending', 'Failed', 'Unsubscribed'],
    default: 'Pending',
  },
  numberOfMessages: {
    type: Number,
    default: 0,
  },
  lastMessagedAt: {
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


