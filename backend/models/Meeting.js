const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  attendees: [{ type: String }],
  notes: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Meeting", meetingSchema);
