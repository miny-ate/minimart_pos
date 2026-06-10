export default async function handler(req, res) {
  try {
    const { shortcode, env } = req.query;
    if (!shortcode) return res.status(400).json({ error: "shortcode query param required" });

    const consumerKey    = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return res.status(500).json({ error: "MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET not set in Vercel environment variables" });
    }

    const isSandbox = (env || "sandbox") !== "production";
    const baseUrl   = isSandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    // 1. Get OAuth token
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64"),
      },
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) return res.status(500).json({ error: "Failed to get access token", tokenData });

    // 2. Build callback URLs from this deployment's host
    const host    = req.headers.host;
    const protocol = host.includes("localhost") ? "http" : "https";
    const fnBase  = `${protocol}://${host}/api`;

    // 3. Register URLs with Safaricom
    const regRes = await fetch(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ShortCode:       shortcode,
        ResponseType:    "Completed",
        ConfirmationURL: `${fnBase}/confirm`,
        ValidationURL:   `${fnBase}/validate`,
      }),
    });

    const regData = await regRes.json();
    return res.json({
      success: true,
      environment: isSandbox ? "sandbox" : "production",
      shortcode,
      confirmationURL: `${fnBase}/confirm`,
      validationURL:   `${fnBase}/validate`,
      safaricomResponse: regData,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
