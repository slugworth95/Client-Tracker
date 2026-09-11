// Custom field definitions — the business-configurable fields on client profiles.
const express = require("express");
const db = require("../db");

const router = express.Router();

const VALID_TYPES = ["text", "number", "date"];

// GET /api/custom-fields — list this user's field definitions
router.get("/", async (req, res) => {
  const rows = await db
    .prepare("SELECT * FROM custom_fields WHERE user_id = ? ORDER BY position, id")
    .all(req.user.id);
  res.json(rows);
});

// POST /api/custom-fields — create a field definition
router.post("/", async (req, res) => {
  const { name, type = "text", required = false } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
  }

  const maxPos = await db
    .prepare("SELECT COALESCE(MAX(position), -1) AS p FROM custom_fields WHERE user_id = ?")
    .get(req.user.id);

  try {
    const result = await db
      .prepare(
        "INSERT INTO custom_fields (user_id, name, type, required, position) VALUES (?, ?, ?, ?, ?)"
      )
      .run(req.user.id, String(name).trim(), type, required ? 1 : 0, maxPos.p + 1);
    const row = await db.prepare("SELECT * FROM custom_fields WHERE id = ?").get(Number(result.lastInsertRowid));
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message).includes("UNIQUE") || String(err.message).includes("duplicate key")) {
      return res.status(409).json({ error: "A field with that name already exists" });
    }
    throw err;
  }
});

// PUT /api/custom-fields/:id — update a field definition
router.put("/:id", async (req, res) => {
  const existing = await db
    .prepare("SELECT * FROM custom_fields WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Field not found" });

  const { name, type, required } = req.body || {};
  const next = {
    name: name !== undefined ? String(name).trim() : existing.name,
    type: type !== undefined ? type : existing.type,
    required: required !== undefined ? (required ? 1 : 0) : existing.required,
  };
  if (!next.name) return res.status(400).json({ error: "name cannot be empty" });
  if (!VALID_TYPES.includes(next.type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` });
  }

  try {
    await db
      .prepare("UPDATE custom_fields SET name = ?, type = ?, required = ? WHERE id = ?")
      .run(next.name, next.type, next.required, existing.id);
    res.json(await db.prepare("SELECT * FROM custom_fields WHERE id = ?").get(existing.id));
  } catch (err) {
    if (String(err.message).includes("UNIQUE") || String(err.message).includes("duplicate key")) {
      return res.status(409).json({ error: "A field with that name already exists" });
    }
    throw err;
  }
});

// DELETE /api/custom-fields/:id — delete a field and strip its values from clients
router.delete("/:id", async (req, res) => {
  const existing = await db
    .prepare("SELECT * FROM custom_fields WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Field not found" });

  await db.prepare("DELETE FROM custom_fields WHERE id = ?").run(existing.id);

  const clients = await db
    .prepare("SELECT id, custom_values FROM clients WHERE user_id = ? AND custom_values IS NOT NULL")
    .all(req.user.id);
  for (const client of clients) {
    let values = {};
    try {
      values = JSON.parse(client.custom_values);
    } catch {
      continue;
    }
    if (values[existing.id] !== undefined) {
      delete values[existing.id];
      await db.prepare("UPDATE clients SET custom_values = ? WHERE id = ?").run(
        Object.keys(values).length ? JSON.stringify(values) : null,
        client.id
      );
    }
  }

  res.status(204).end();
});

module.exports = router;