const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  projectId: { type: String, required: true },
  assigneeId: { type: String, required: true },
  startDate: { type: String },
  deadline: { type: String, required: true },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  status: { type: String, enum: ["todo", "progress", "review", "completed", "changes"], default: "todo" },
  progress: { type: Number, default: 0 },
  submission: {
    note: { type: String, default: "" },
    link: { type: String, default: "" },
    files: { type: String, default: "" }
  },
  feedback: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Task", taskSchema);

