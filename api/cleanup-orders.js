export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({ error: "Mangler Supabase env vars" });
    }

    const EXPIRY_MINUTES = 30;
    const cutoff = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString();

    const deleteRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?status=eq.pending_payment&created_at=lt.${cutoff}`,
      {
        method: "DELETE",
        headers: {
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "Prefer": "return=representation"
        }
      }
    );

    const deleted = await deleteRes.json();

    if (!deleteRes.ok) {
      return res.status(500).json({ error: "Kunne ikke slette utløpte ordre", details: deleted });
    }

    return res.status(200).json({ ok: true, deleted: deleted.length });
  } catch (err) {
    return res.status(500).json({ error: "Feil i cleanup", details: String(err) });
  }
}
