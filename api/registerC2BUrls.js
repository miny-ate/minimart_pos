export default async function handler(req, res) {
  try {
    const { shortcode, env } = req.query;
    if (!shortcode) return res.status(400).send("shortcode required");

    const consumerKey    = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return res.status(500).send("M-Pesa credentials not set in Vercel environment variables");
    }

    const isSandbox = (env || "sandbox") === "sandbox";
    const baseUrl   = isSandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64"),
      },
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) return res.status(500).json({ error: "Failed to get token", tokenData });

    const fnBase = `https://${req.headers.host}/api`;

    const regRes = await fetch(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ShortCode:       shortcode,
        ResponseType:    "Completed",
        ConfirmationURL: `${fnBase}/confirmation`,
        ValidationURL:   `${fnBase}/validation`,
      }),
    });

    const regData = await regRes.json();
    res.json({ success: true, regData, confirmationUrl: `${fnBase}/confirmation` });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
