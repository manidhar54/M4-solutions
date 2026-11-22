require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const User = require("./models/User");
const Project = require("./models/Project");
const Task = require("./models/Task");
const Meeting = require("./models/Meeting");
const Message = require("./models/Message");
const Document = require("./models/Document");
const { auth, founderOnly } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "..")));

const formatDoc = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  delete obj.password;
  return obj;
};

// --- AUTH ROUTES ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, portal } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    if (!user.active) return res.status(403).json({ error: "Account is deactivated" });

    if (portal === "founder" && user.appRole !== "founder") {
      return res.status(403).json({ error: "Not authorized for Founder Portal" });
    }
    if (portal === "employee" && user.appRole === "founder") {
      return res.status(403).json({ error: "Please use the Founder Portal" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, appRole: user.appRole },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: formatDoc(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- BOOTSTRAP ALL WORKSPACE DATA ---
app.get("/api/workspace", auth, async (req, res) => {
  try {
    const [users, projects, tasks, meetings, messages, documents] = await Promise.all([
      User.find().sort({ createdAt: 1 }),
      Project.find().sort({ createdAt: -1 }),
      Task.find().sort({ createdAt: -1 }),
      Meeting.find().sort({ date: 1, time: 1 }),
      Message.find().sort({ createdAt: -1 }),
      Document.find().sort({ createdAt: -1 })
    ]);

    res.json({
      users: users.map(formatDoc),
      projects: projects.map(formatDoc),
      tasks: tasks.map(formatDoc),
      meetings: meetings.map(formatDoc),
      messages: messages.map(formatDoc),
      documents: documents.map(formatDoc)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USERS / EMPLOYEES ---
app.post("/api/users", auth, founderOnly, async (req, res) => {
  try {
    const { name, email, password, phone, department, roleTitle, appRole } = req.body;
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password || "welcome123", 10);
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone,
      department,
      roleTitle,
      appRole: appRole === "founder" ? "employee" : (appRole || "employee")
    });
    res.status(201).json(formatDoc(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", auth, async (req, res) => {
  try {
    if (req.user.appRole !== "founder" && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updates = { ...req.body };
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    } else {
      delete updates.password;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { returnDocument: "after" });
    res.json(formatDoc(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", auth, founderOnly, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: "Cannot delete your own Founder account" });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROJECTS ---
app.post("/api/projects", auth, founderOnly, async (req, res) => {
  try {
    const project = await Project.create(req.body);
    res.status(201).json(formatDoc(project));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/projects/:id", auth, founderOnly, async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
    res.json(formatDoc(project));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/projects/:id", auth, founderOnly, async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    await Task.deleteMany({ projectId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASKS ---
app.post("/api/tasks", auth, async (req, res) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json(formatDoc(task));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/tasks/:id", auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
    res.json(formatDoc(task));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/tasks/:id", auth, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MEETINGS ---
app.post("/api/meetings", auth, founderOnly, async (req, res) => {
  try {
    const meeting = await Meeting.create(req.body);
    res.status(201).json(formatDoc(meeting));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/meetings/:id", auth, founderOnly, async (req, res) => {
  try {
    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- MESSAGES / ANNOUNCEMENTS ---
app.post("/api/messages", auth, async (req, res) => {
  try {
    const message = await Message.create(req.body);
    res.status(201).json(formatDoc(message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/messages/:id", auth, async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- DOCUMENTS ---
app.post("/api/documents", auth, async (req, res) => {
  try {
    const doc = await Document.create(req.body);
    res.status(201).json(formatDoc(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/documents/:id", auth, async (req, res) => {
  try {
    await Document.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    app.listen(PORT, () => console.log(`M4 Solutions API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
