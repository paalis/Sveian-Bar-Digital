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

    const event = req.body || {};
    const eventName = event.name || "";
    const resource = event.resource || {};
    const reference = resource.reference || event.reference || "";

    if (!reference) {
      return res.status(200).json({ ok: true, ignored: "missing reference" });
    }

    // reference er nå på formen: sveian-123-17123456789
    const match = String(reference).match(/^sveian-(\d+)-/);
    const orderNumber = match ? Number(match[1]) : null;

    if (!orderNumber) {
      return res.status(200).json({ ok: true, ignored: "unknown reference format" });
    }

    let newStatus = null;

    // Tilpass disse etter hvilke events Vipps faktisk sender for din ePayment-flyt
    if (
      eventName.includes("authorized") ||
      eventName.includes("captured") ||
      eventName.includes("sale.completed") ||
      eventName.includes("payment.captured")
    ) {
      newStatus = "paid";
    } else if (
      eventName.includes("aborted") ||
      eventName.includes("cancelled") ||
      eventName.includes("expired")
    ) {
      newStatus = "aborted";
    }

    if (!newStatus) {
      return res.status(200).json({ ok: true, ignored: eventName });
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
        body: JSON.stringify({ status: newStatus })
      }
    );

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      return res.status(500).json({
        error: "Kunne ikke oppdatere ordrestatus",
        details: updateData
      });
    }

    return res.status(200).json({
      ok: true,
      orderNumber,
      status: newStatus
    });
  } catch (err) {
    return res.status(500).json({
      error: "Webhook-feil",
      details: String(err)
    });
  }
}
