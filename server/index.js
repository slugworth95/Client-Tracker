// Client Tracker — Express server.
// Serves the frontend from /public and exposes the JSON API under /api.
const path = require("node:path");
const express = require("express");
const { register, login, requireAuth } = require("./auth");
const clientsRouter = require("./routes/clients");
const customFieldsRouter = require("./routes/customFields");
const notesRouter = require("./routes/notes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// CORS — allow other local tools (Proposal Builder, Invoice Generator, etc.)
// to call this API from their own origins.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health check — lets other tools discover this service.
app.get("/api/health", (req, res) => {
  res.json({ service: "client-tracker", status: "ok", version: "1.1.0" });
});

// Auth
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }
  try {
    const { user, token } = register({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: String(password),
    });
    res.status(201).json({ user, token });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    throw err;
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const result = login({
    email: String(email).trim().toLowerCase(),
    password: String(password),
  });
  if (!result) return res.status(401).json({ error: "Invalid email or password" });
  res.json(result);
});

// Protected API
app.use("/api/clients", requireAuth, clientsRouter);
app.use("/api/custom-fields", requireAuth, customFieldsRouter);
app.use("/api", requireAuth, notesRouter);

// Error handler (keeps stack traces out of API responses)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Client Tracker running at http://localhost:${PORT}`);
});