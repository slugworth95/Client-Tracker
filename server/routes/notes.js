// Timestamped notes attached to clients.
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/clients/:clientId/notes — list notes (newest first)
router.get("/clients/:clientId/notes", (req, res) => {
  const client = db
    .prepare("SELECT id FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.clientId, req.user.id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  res.json(
    db
      .prepare("SELECT * FROM notes WHERE client_id = ? ORDER BY created_at DESC, id DESC")
      .all(client.id)
  );
});

// POST /api/clients/:clientId/notes — add a note
router.post("/clients/:clientId/notes", (req, res) => {
  const client = db
    .prepare("SELECT id FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.clientId, req.user.id);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const { body } = req.body || {};
  if (!body || !String(body).trim()) {
    return res.status(400).json({ error: "body is required" });
  }

  const result = db
    .prepare("INSERT INTO notes (client_id, user_id, body) VALUES (?, ?, ?)")
    .run(client.id, req.user.id, String(body).trim());
  res
    .status(201)
    .json(db.prepare("SELECT * FROM notes WHERE id = ?").get(Number(result.lastInsertRowid)));
});

// DELETE /api/notes/:id — delete a note
router.delete("/notes/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Note not found" });
  res.status(204).end();
});

module.exports = router;