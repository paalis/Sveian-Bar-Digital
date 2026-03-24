export default async function handler(req, res) {
  try {
    const { order } = req.query;

    if (!order) {
      return res.status(400).json({ error: "Mangler order" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({ error: "Mangler Supabase config" });
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(order)}&select=*`,
      {
        headers: {
          "apikey": supabaseServiceRoleKey,
          "Authorization": `Bearer ${supabaseServiceRoleKey}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "Kunne ikke hente ordre",
        details: data
      });
    }

    return res.status(200).json(data[0] || null);
  } catch (err) {
    return res.status(500).json({
      error: "Feil i get-order",
      details: String(err)
    });
  }
}
