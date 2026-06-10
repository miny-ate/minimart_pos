export default function handler(req, res) {
  // Safaricom pings with GET to verify the URL is alive
  if (req.method === "GET") {
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  console.log("M-Pesa Validation:", JSON.stringify(req.body));
  // Return 0 = allow the transaction to proceed
  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
