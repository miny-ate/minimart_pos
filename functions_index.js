const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * M-Pesa C2B Validation URL
 * Safaricom calls this first to ask if you want to accept the payment.
 * Always return success so payments are accepted.
 */
exports.mpesaValidation = functions.https.onRequest(async (req, res) => {
  console.log("M-Pesa Validation:", JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

/**
 * M-Pesa C2B Confirmation URL
 * Safaricom calls this after payment is confirmed on their end.
 * We save it to Firestore; the POS polls for matching payments.
 *
 * Safaricom POST body example:
 * {
 *   "TransactionType": "Pay Bill",
 *   "TransID": "QHX4B7K9LL",
 *   "TransTime": "20240101120000",
 *   "TransAmount": "1500.00",
 *   "BusinessShortCode": "174379",
 *   "BillRefNumber": "TILL001",
 *   "InvoiceNumber": "",
 *   "OrgAccountBalance": "",
 *   "ThirdPartyTransID": "",
 *   "MSISDN": "254712345678",
 *   "FirstName": "John",
 *   "MiddleName": "",
 *   "LastName": "Doe"
 * }
 */
exports.mpesaConfirmation = functions.https.onRequest(async (req, res) => {
  try {
    console.log("M-Pesa Confirmation received:", JSON.stringify(req.body));

    const body = req.body;

    // Extract fields from Safaricom C2B payload
    const reference   = body.TransID         || "";
    const amount      = parseFloat(body.TransAmount || "0");
    const phone       = body.MSISDN           || "";
    const accountRef  = body.BillRefNumber    || "";
    const firstName   = body.FirstName        || "";
    const lastName    = body.LastName         || "";
    const transTime   = body.TransTime        || "";
    const shortCode   = body.BusinessShortCode || "";

    if (!reference || !amount) {
      console.error("Missing required fields in callback");
      // Still return success to Safaricom — we don't want them to retry
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Save to Firestore — POS listens to this collection
    await db.collection("mpesa_payments").doc(reference).set({
      reference,
      amount,
      phone,
      accountRef,
      customerName: `${firstName} ${lastName}`.trim(),
      transTime,
      shortCode,
      status: "pending",   // POS will update to "matched" when it links to a sale
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Payment saved: ${reference} | KSh ${amount} | ${phone}`);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error) {
    console.error("Confirmation error:", error);
    // Always return 0 to Safaricom so they don't retry
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

/**
 * Register C2B URLs with Safaricom (call this once during setup).
 * Trigger via: GET /registerC2BUrls?shortcode=YOUR_SHORTCODE&env=sandbox
 */
exports.registerC2BUrls = functions.https.onRequest(async (req, res) => {
  try {
    const { shortcode, env } = req.query;
    if (!shortcode) return res.status(400).send("shortcode required");

    const config = functions.config();
    const consumerKey    = config.mpesa?.consumer_key;
    const consumerSecret = config.mpesa?.consumer_secret;

    if (!consumerKey || !consumerSecret) {
      return res.status(500).send(
        "M-Pesa credentials not configured. Run:\n" +
        "firebase functions:config:set mpesa.consumer_key=YOUR_KEY mpesa.consumer_secret=YOUR_SECRET"
      );
    }

    const isSandbox = (env || "sandbox") === "sandbox";
    const baseUrl = isSandbox
      ? "https://sandbox.safaricom.co.ke"
      : "https://api.safaricom.co.ke";

    // Step 1: Get OAuth token
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64"),
      },
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) return res.status(500).json({ error: "Failed to get token", tokenData });

    // Step 2: Your Cloud Functions base URL
    const projectId = process.env.GCLOUD_PROJECT;
    const region = "us-central1";
    const fnBase = `https://${region}-${projectId}.cloudfunctions.net`;

    // Step 3: Register URLs
    const regRes = await fetch(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ShortCode: shortcode,
        ResponseType: "Completed",
        ConfirmationURL: `${fnBase}/mpesaConfirmation`,
        ValidationURL: `${fnBase}/mpesaValidation`,
      }),
    });

    const regData = await regRes.json();
    console.log("C2B registration response:", regData);
    res.json({ success: true, regData, confirmationUrl: `${fnBase}/mpesaConfirmation` });

  } catch (error) {
    console.error("Register URLs error:", error);
    res.status(500).json({ error: error.message });
  }
});
