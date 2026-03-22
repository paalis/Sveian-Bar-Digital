export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const total = Number(body.total || 0);
    const items = body.items || [];

    if (!total || total <= 0) {
      return res.status(400).json({ error: "Ugyldig totalbeløp" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const vippsClientId = process.env.VIPPS_CLIENT_ID;
    const vippsClientSecret = process.env.VIPPS_CLIENT_SECRET;
    const vippsSubscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY;
    const vippsMerchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER;
    const appBaseUrl = process.env.APP_BASE_URL;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error: "Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY"
      });
    }

    if (
      !vippsClientId ||
      !vippsClientSecret ||
      !vippsSubscriptionKey ||
      !vippsMerchantSerialNumber ||
      !appBaseUrl
    ) {
      return res.status(500).json({
        error: "Mangler VIPPS_* eller APP_BASE_URL env vars"
      });
    }

    // 1. Lagre ordre i Supabase først
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

    const orderId = inserted[0].id;
    const orderNumber = inserted[0].order_number;

    // Vipps bruker minor units: NOK 100,00 = 10000
    const amountInOre = Math.round(total * 100);

    // 2. Hent access token fra Vipps test
    const tokenRes = await fetch("https://apitest.vipps.no/accesstoken/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client_id": vippsClientId,
        "client_secret": vippsClientSecret,
        "Ocp-Apim-Subscription-Key": vippsSubscriptionKey,
        "Merchant-Serial-Number": vippsMerchantSerialNumber
      }
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({
        error: "Kunne ikke hente Vipps access token",
        details: tokenData
      });
    }

    const accessToken = tokenData.access_token;

    // 3. Opprett Vipps-betaling
    const idempotencyKey =
      (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();

    const returnUrl =
      `${appBaseUrl}/payment-complete.html?orderId=${encodeURIComponent(orderId)}&order=${encodeURIComponent(orderNumber)}`;

    const paymentPayload = {
      amount: {
        value: amountInOre,
        currency: "NOK"
      },
      paymentMethod: {
        type: "WALLET"
      },
      reference: String(orderNumber),
      userFlow: "WEB_REDIRECT",
      returnUrl,
      paymentDescription: `Sommerfest på Sveian ordre #${orderNumber}`
    };

    const vippsRes = await fetch("https://apitest.vipps.no/epayment/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Ocp-Apim-Subscription-Key": vippsSubscriptionKey,
        "Merchant-Serial-Number": vippsMerchantSerialNumber,
        "Idempotency-Key": idempotencyKey,
        "Vipps-System-Name": "sveian-festival",
        "Vipps-System-Version": "1.0.0",
        "Vipps-System-Plugin-Name": "vercel-web",
        "Vipps-System-Plugin-Version": "1.0.0"
      },
      body: JSON.stringify(paymentPayload)
    });

    const vippsData = await vippsRes.json();

    if (!vippsRes.ok) {
      return res.status(500).json({
        error: "Kunne ikke opprette Vipps-betaling",
        details: vippsData
      });
    }

    // 4. Lagre Vipps payment reference hvis du vil ha det i databasen senere
    // Krever at du har en kolonne, ellers kan du droppe denne blokken.
    // try {
    //   await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}`, {
    //     method: "PATCH",
    //     headers: {
    //       "Content-Type": "application/json",
    //       "apikey": supabaseServiceRoleKey,
    //       "Authorization": `Bearer ${supabaseServiceRoleKey}`
    //     },
    //     body: JSON.stringify({
    //       vipps_reference: String(orderNumber)
    //     })
    //   });
    // } catch {}

    return res.status(200).json({
      success: true,
      orderId,
      orderNumber,
      total,
      url: vippsData.redirectUrl
    });
  } catch (err) {
    return res.status(500).json({
      error: "Feil i backend",
      details: String(err)
    });
  }
}
