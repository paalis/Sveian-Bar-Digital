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
    console.log("VIPPS WEBHOOK EVENT:", JSON.stringify(event, null, 2));

    // Vipps sender reference og name på top-level
    const reference = event.reference || "";
    const eventName = String(event.name || "").toUpperCase();
    const success = event.success;

    if (!reference) {
      return res.status(200).json({ ok: true, ignored: "missing reference" });
    }

    // reference fra create-payment.js: sveian-<orderNumber>-<timestamp>
    const match = String(reference).match(/^sveian-(\d+)-/);
    const orderNumber = match ? Number(match[1]) : null;

    if (!orderNumber) {
      return res.status(200).json({ ok: true, ignored: "unknown reference format" });
    }

    let newStatus = null;

    if ((eventName === "AUTHORIZED" || eventName === "CAPTURED") && success === true) {
      newStatus = "paid";
    } else if (
      eventName === "ABORTED" ||
      eventName === "CANCELLED" ||
      eventName === "EXPIRED" ||
      eventName === "TERMINATED"
    ) {
      newStatus = "aborted";
    }

    if (!newStatus) {
      return res.status(200).json({
        ok: true,
        ignored: `Unhandled event: ${eventName}`
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
      status: newStatus,
      eventName
    });
  } catch (err) {
    return res.status(500).json({
      error: "Webhook-feil",
      details: String(err)
    });
  }
}
