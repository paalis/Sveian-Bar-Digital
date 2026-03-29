export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { id, orderNumber, status } = body;

    const ALLOWED_STATUSES = ["pending_payment", "paid", "delivered", "aborted"];
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Ugyldig status" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error: "Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    let filter = "";
    if (id) {
      filter = `id=eq.${id}`;
    } else if (orderNumber) {
      filter = `order_number=eq.${orderNumber}`;
    } else {
      return res.status(400).json({
        error: "Mangler id eller orderNumber"
      });
    }

    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?${filter}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ status })
      }
    );

    const updated = await updateRes.json();

    if (!updateRes.ok) {
      return res.status(500).json({
        error: "Kunne ikke oppdatere ordrestatus",
        details: updated
      });
    }

    if (!updated || updated.length === 0) {
      return res.status(404).json({
        error: "Fant ingen ordre å oppdatere"
      });
    }

    return res.status(200).json({
      success: true,
      updated
    });
  } catch (err) {
    return res.status(500).json({
      error: "Feil i backend",
      details: String(err)
    });
  }
}
