const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  projectId: { type: String, default: "" },
  uploadedBy: { type: String, required: true },
  size: { type: String, default: "" },
  dataUrl: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Document", documentSchema);
