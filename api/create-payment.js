export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const total = body.total || 0;
    const orderId = Math.floor(Math.random() * 100000);

    const vippsUrl = `/vipps-test.html?order=${orderId}&amount=${total}`;

    res.status(200).json({
      orderId,
      url: vippsUrl
    });

  } catch (err) {
    res.status(500).json({ error: "Feil i backend" });
  }
}
