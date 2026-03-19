export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { orderNumber, status } = body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error: "Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_number=eq.${orderNumber}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          status: status
        })
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
        error: "Fant ingen ordre med dette ordrenummeret",
        orderNumber
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
