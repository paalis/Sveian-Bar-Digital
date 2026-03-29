export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const vippsApiBaseUrl = process.env.VIPPS_API_BASE_URL || "https://apitest.vipps.no";
    const vippsClientId = process.env.VIPPS_CLIENT_ID;
    const vippsClientSecret = process.env.VIPPS_CLIENT_SECRET;
    const vippsSubscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY;
    const vippsMerchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER;

    if (
      !vippsClientId ||
      !vippsClientSecret ||
      !vippsSubscriptionKey ||
      !vippsMerchantSerialNumber
    ) {
      return res.status(500).json({
        error: "Mangler VIPPS env vars"
      });
    }

    const tokenRes = await fetch(`${vippsApiBaseUrl}/accesstoken/get`, {
      method: "POST",
      headers: {
        "client_id": vippsClientId,
        "client_secret": vippsClientSecret,
        "Ocp-Apim-Subscription-Key": vippsSubscriptionKey,
        "Merchant-Serial-Number": vippsMerchantSerialNumber
      }
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).json({
        error: "Kunne ikke hente token",
        details: tokenData
      });
    }

    const accessToken = tokenData.access_token;

    const webhookRes = await fetch(`${vippsApiBaseUrl}/webhooks/v1/webhooks`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Ocp-Apim-Subscription-Key": vippsSubscriptionKey,
        "Merchant-Serial-Number": vippsMerchantSerialNumber,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: "https://sveian-bar-digital.vercel.app/api/vipps-webhook",
        events: [
          "epayments.payment.authorized.v1",
          "epayments.payment.captured.v1",
          "epayments.payment.aborted.v1",
          "epayments.payment.cancelled.v1",
          "epayments.payment.expired.v1"
        ]
      })
    });

    const webhookData = await webhookRes.json();

    if (!webhookRes.ok) {
      return res.status(500).json({
        error: "Kunne ikke opprette webhook",
        details: webhookData
      });
    }

    return res.status(200).json({
      success: true,
      webhook: webhookData
    });
  } catch (err) {
    return res.status(500).json({
      error: "Feil",
      details: String(err)
    });
  }
}
