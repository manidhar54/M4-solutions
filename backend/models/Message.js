const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  type: { type: String, enum: ["announcement", "update"], default: "update" },
  authorId: { type: String, required: true },
  body: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
