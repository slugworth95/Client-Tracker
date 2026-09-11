// Client CRUD API. This is the integration surface other tools will call.
const express = require("express");
const db = require("../db");

const router = express.Router();

const VALID_STATUSES = ["lead", "active", "past", "lost"];

function parseTags(tags) {
  if (Array.isArray(tags)) return tags.join(",");
  if (typeof tags === "string") return tags.trim() || null;
  return null;
}

// Parse the stored JSON custom_values column into a plain object.
function serializeClient(row) {
  if (!row) return null;
  const { custom_values, follow_up_date, ...rest } = row;
  let customValues = {};
  try {
    customValues = custom_values ? JSON.parse(custom_values) : {};
  } catch {
    customValues = {};
  }
  return { ...rest, followUpDate: follow_up_date || null, customValues };
}

// Validate customValues against the user's field definitions.
// Returns { values: JSON string or null, error: string or null }.
async function validateCustomValues(userId, customValues) {
  if (customValues === undefined || customValues === null) {
    return { values: null, error: null };
  }
  if (typeof customValues !== "object" || Array.isArray(customValues)) {
    return { values: null, error: "customValues must be an object" };
  }

  const fields = await db.prepare("SELECT * FROM custom_fields WHERE user_id = ?").all(userId);
  const byId = new Map(fields.map((f) => [String(f.id), f]));
  const cleaned = {};

  for (const [key, raw] of Object.entries(customValues)) {
    const field = byId.get(String(key));
    if (!field) continue; // ignore unknown fields

    if (raw === "" || raw === null || raw === undefined) {
      if (field.required) return { values: null, error: `"${field.name}" is required` };
      continue;
    }

    let value = raw;
    if (field.type === "number") {
      const n = Number(value);
      if (Number.isNaN(n)) return { values: null, error: `"${field.name}" must be a number` };
      value = n;
    }
    cleaned[String(field.id)] = String(value);
  }

  for (const field of fields) {
    if (field.required && cleaned[String(field.id)] === undefined) {
      return { values: null, error: `"${field.name}" is required` };
    }
  }

  return {
    values: Object.keys(cleaned).length ? JSON.stringify(cleaned) : null,
    error: null,
  };
}

// GET /api/clients?search=&status=&followUp=1 — list
router.get("/", async (req, res) => {
  const { search = "", status, followUp } = req.query;
  const params = [req.user.id];
  let sql = "SELECT * FROM clients WHERE user_id = ?";

  if (status && VALID_STATUSES.includes(status)) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (followUp === "1") {
    // Due within the next 7 days (including overdue).
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const dueStr =
      due.getFullYear() + "-" + String(due.getMonth() + 1).padStart(2, "0") + "-" + String(due.getDate()).padStart(2, "0");
    sql += " AND follow_up_date IS NOT NULL AND follow_up_date <= ?";
    params.push(dueStr);
  }
  if (search) {
    sql += " AND (name LIKE ? OR company LIKE ? OR email LIKE ? OR tags LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += followUp === "1" ? " ORDER BY follow_up_date ASC" : " ORDER BY updated_at DESC";

  const rows = await db.prepare(sql).all(...params);
  res.json(rows.map(serializeClient));
});

// GET /api/clients/:id — one client
router.get("/:id", async (req, res) => {
  const client = await db
    .prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(serializeClient(client));
});

// POST /api/clients — create
router.post("/", async (req, res) => {
  const { name, company, email, phone, status = "lead", notes, tags, customValues, followUpDate } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  const { values, error } = await validateCustomValues(req.user.id, customValues);
  if (error) return res.status(400).json({ error });

  const result = await db
    .prepare(
      `INSERT INTO clients (user_id, name, company, email, phone, status, notes, tags, custom_values, follow_up_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.id,
      String(name).trim(),
      company || null,
      email || null,
      phone || null,
      status,
      notes || null,
      parseTags(tags),
      values,
      followUpDate || null
    );

  const client = await db.prepare("SELECT * FROM clients WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json(serializeClient(client));
});

// PUT /api/clients/:id — update (partial updates allowed)
router.put("/:id", async (req, res) => {
  const existing = await db
    .prepare("SELECT * FROM clients WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Client not found" });

  const { name, company, email, phone, status, notes, tags, customValues, followUpDate } = req.body || {};
  const next = {
    name: name !== undefined ? String(name).trim() : existing.name,
    company: company !== undefined ? company : existing.company,
    email: email !== undefined ? email : existing.email,
    phone: phone !== undefined ? phone : existing.phone,
    status: status !== undefined ? status : existing.status,
    notes: notes !== undefined ? notes : existing.notes,
    tags: tags !== undefined ? parseTags(tags) : existing.tags,
    followUpDate: followUpDate !== undefined ? followUpDate : existing.follow_up_date,
  };

  if (!next.name) return res.status(400).json({ error: "name cannot be empty" });
  if (!VALID_STATUSES.includes(next.status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  // Only validate customValues when the request actually includes them.
  let nextValues = existing.custom_values;
  if (customValues !== undefined) {
    const { values, error } = await validateCustomValues(req.user.id, customValues);
    if (error) return res.status(400).json({ error });
    nextValues = values;
  }

  await db
    .prepare(
      `UPDATE clients
       SET name = ?, company = ?, email = ?, phone = ?, status = ?, notes = ?, tags = ?, custom_values = ?, follow_up_date = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      next.name,
      next.company,
      next.email,
      next.phone,
      next.status,
      next.notes,
      next.tags,
      nextValues,
      next.followUpDate,
      existing.id
    );

  res.json(serializeClient(await db.prepare("SELECT * FROM clients WHERE id = ?").get(existing.id)));
});

// DELETE /api/clients/:id
router.delete("/:id", async (req, res) => {
  const result = await db
    .prepare("DELETE FROM clients WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Client not found" });
  res.status(204).end();
});

module.exports = router;