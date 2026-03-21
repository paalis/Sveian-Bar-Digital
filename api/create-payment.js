export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const total = body.total || 0;
    const items = body.items || [];

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error: "Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify([{
        status: "pending_payment",
        total: total,
        items_json: items
      }])
    });

    const inserted = await insertRes.json();

    if (!insertRes.ok) {
      return res.status(500).json({
        error: "Kunne ikke lagre ordre i Supabase",
        details: inserted
      });
    }

    const orderNumber = inserted[0].order_number;
    const vippsUrl = `/vipps-test.html?order=${orderNumber}&amount=${total}`;

    return res.status(200).json({
      orderId: inserted[0].id,
      orderNumber,
      url: vippsUrl
    });
  } catch (err) {
    return res.status(500).json({
      error: "Feil i backend",
      details: String(err)
    });
  }
}
