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

    const webhookSecret = process.env.VIPPS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers["authorization"] || "";
      if (authHeader !== webhookSecret) {
        console.log("VIPPS WEBHOOK: Ugyldig signatur");
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const event = req.body || {};
    console.log("VIPPS WEBHOOK EVENT RAW:", JSON.stringify(event, null, 2));

    const eventName = String(event.name || "").toUpperCase();

    const reference =
      event.reference ||
      event.resource?.reference ||
      event.data?.reference ||
      "";

    console.log("VIPPS WEBHOOK PARSED:", JSON.stringify({
      eventName,
      reference
    }));

    if (!reference) {
      return res.status(200).json({ ok: true, ignored: "missing reference" });
    }

    const match = String(reference).match(/^sveian-(\d+)-/);
    const orderNumber = match ? Number(match[1]) : null;

    console.log("VIPPS WEBHOOK ORDER MATCH:", JSON.stringify({
      reference,
      orderNumber
    }));

    if (!orderNumber) {
      return res.status(200).json({ ok: true, ignored: "unknown reference format" });
    }

    let newStatus = null;

    if (
      eventName.includes("AUTHORIZED") ||
      eventName.includes("CAPTURED")
    ) {
      newStatus = "paid";
    } else if (
      eventName.includes("ABORTED") ||
      eventName.includes("CANCELLED") ||
      eventName.includes("EXPIRED") ||
      eventName.includes("TERMINATED")
    ) {
      newStatus = "aborted";
    }

    console.log("VIPPS WEBHOOK STATUS MAP:", JSON.stringify({
      eventName,
      newStatus
    }));

    if (!newStatus) {
      return res.status(200).json({
        ok: true,
        ignored: `Unhandled event: ${eventName}`
      });
    }

    const updateUrl = `${supabaseUrl}/rest/v1/orders?order_number=eq.${orderNumber}`;

    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceRoleKey,
        "Authorization": `Bearer ${supabaseServiceRoleKey}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ status: newStatus })
    });

    const updateData = await updateRes.json();

    console.log("VIPPS WEBHOOK SUPABASE UPDATE:", JSON.stringify({
      orderNumber,
      newStatus,
      ok: updateRes.ok,
      updateData
    }));

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
    console.log("VIPPS WEBHOOK ERROR:", String(err));
    return res.status(500).json({
      error: "Webhook-feil",
      details: String(err)
    });
  }
}
