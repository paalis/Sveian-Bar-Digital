export default async function handler(req, res) {
  try {
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

    // 1. Hent token
    const tokenRes = await fetch("https://apitest.vipps.no/accesstoken/get", {
      method: "POST",
      headers: {
        "client_id": vippsClientId,
        "client_secret": vippsClientSecret,
        "Ocp-Apim-Subscription-Key": vippsSubscriptionKey,
        "Merchant-Serial-Number": vippsMerchantSerialNumber
      }
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(500).json({
        error: "Kunne ikke hente token",
        details: tokenData
      });
    }

    const accessToken = tokenData.access_token;

    // 2. Opprett webhook
    const webhookRes = await fetch("https://apitest.vipps.no/webhooks/v1/webhooks", {
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
