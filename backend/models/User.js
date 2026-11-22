const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, default: "" },
  department: { type: String, default: "Engineering" },
  roleTitle: { type: String, default: "Employee" },
  appRole: { type: String, enum: ["founder", "teamlead", "employee"], default: "employee" },
  active: { type: Boolean, default: true },
  photo: { type: String, default: "" },
  joined: { type: String, default: () => new Date().toISOString().split("T")[0] }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
