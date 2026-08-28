const GITHUB_REPO = process.env.GITHUB_REPO || "dreamhomesarchitecture/dotazn-k-klienta";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_KEY = "Dreamhomes274";
const VALID_TYPES = ["dotaznik", "dsp", "dps"];

function pathForType(type) {
  const safeType = VALID_TYPES.includes(type) ? type : "dotaznik";
  return `data/questions-${safeType}.json`;
}

async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  return res.json();
}

async function ghPut(path, contentObj, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64")
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

module.exports = async (req, res) => {
  try {
    if (!GITHUB_TOKEN) return res.status(500).json({ error: "GITHUB_TOKEN not configured" });

    const path = pathForType(req.query && req.query.type);

    if (req.method === "GET") {
      const file = await ghGet(path);
      if (!file) return res.status(404).json({ found: false });
      const json = JSON.parse(Buffer.from(file.content, "base64").toString("utf-8"));
      return res.status(200).json({ found: true, questions: json });
    }

    if (req.method === "PUT") {
      if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(401).json({ error: "unauthorized" });
      const existing = await ghGet(path);
      await ghPut(path, req.body, existing ? existing.sha : undefined, `Aktualizace otazek dotazniku (${path})`);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
