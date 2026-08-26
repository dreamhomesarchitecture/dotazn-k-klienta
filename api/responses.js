const GITHUB_REPO = process.env.GITHUB_REPO || "dreamhomesarchitecture/dotazn-k-klienta";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_KEY = "Dreamhomes274";
const DIR = "data/responses";

module.exports = async (req, res) => {
  try {
    if (!GITHUB_TOKEN) return res.status(500).json({ error: "GITHUB_TOKEN not configured" });

    if (req.method === "POST") {
      const record = req.body;
      const key = `${DIR}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.json`;
      const body = {
        message: `Nova odpoved ${record && record.submittedAt ? record.submittedAt : new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(record, null, 2)).toString("base64")
      };
      const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${key}`, {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!ghRes.ok) return res.status(502).json({ error: "github write failed", detail: await ghRes.text() });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "GET") {
      if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(401).json({ error: "unauthorized" });
      const listRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${DIR}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }
      });
      if (listRes.status === 404) return res.status(200).json({ items: [] });
      if (!listRes.ok) return res.status(502).json({ error: "list failed" });
      const files = await listRes.json();
      const items = [];
      for (const f of files) {
        try {
          const fileRes = await fetch(f.download_url);
          const json = await fileRes.json();
          json._key = f.path;
          items.push(json);
        } catch (e) {}
      }
      items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      return res.status(200).json({ items });
    }

    if (req.method === "DELETE") {
      if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(401).json({ error: "unauthorized" });
      const key = req.query && req.query.key;
      if (!key || !key.startsWith(`${DIR}/`)) return res.status(400).json({ error: "invalid key" });
      const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${key}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }
      });
      if (!getRes.ok) return res.status(404).json({ error: "not found" });
      const fileData = await getRes.json();
      const delRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: `Smazana odpoved ${key}`, sha: fileData.sha })
      });
      if (!delRes.ok) return res.status(502).json({ error: "delete failed", detail: await delRes.text() });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
