export default function handler(req, res) {
  console.log("M-Pesa Validation:", JSON.stringify(req.body));
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
