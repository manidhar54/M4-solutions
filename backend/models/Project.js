const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  ownerId: { type: String, required: true },
  memberIds: [{ type: String }],
  deadline: { type: String, required: true },
  status: { type: String, enum: ["active", "paused", "completed"], default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);

