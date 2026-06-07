export default async function handler(req, res) {
  // Safaricom pings this URL via GET to verify it's alive
  if (req.method === 'GET') {
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
  
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:     process.env.FIREBASE_PROJECT_ID,
      clientEmail:   process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:    process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  try {
    const body = req.body;
    const reference  = body.TransID          || "";
    const amount     = parseFloat(body.TransAmount || "0");
    const phone      = body.MSISDN            || "";
    const accountRef = body.BillRefNumber     || "";
    const firstName  = body.FirstName         || "";
    const lastName   = body.LastName          || "";
    const transTime  = body.TransTime         || "";
    const shortCode  = body.BusinessShortCode || "";

    if (!reference || !amount) {
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    await db.collection("mpesa_payments").doc(reference).set({
      reference,
      amount,
      phone,
      accountRef,
      customerName: `${firstName} ${lastName}`.trim(),
      transTime,
      shortCode,
      status: "pending",
      receivedAt: FieldValue.serverTimestamp(),
    });

    console.log(`Payment saved: ${reference} | KSh ${amount} | ${phone}`);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  } catch (error) {
    console.error("Confirmation error:", error);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
