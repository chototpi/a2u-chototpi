import dotenv from "dotenv";
import * as StellarSdk from "@stellar/stellar-sdk";
import axios from "axios";

dotenv.config();

const server = new StellarSdk.Server("https://api.testnet.minepi.com");

const PI_API_KEY = process.env.PI_API_KEY!;
const APP_PUBLIC_KEY = process.env.APP_PUBLIC_KEY!;
const APP_PRIVATE_KEY = process.env.APP_PRIVATE_KEY!;

// Test API route with Express
import express from "express";
const app = express();
app.use(express.json());

app.get("/ping", (_, res) => {
  res.send("✅ Pi A2U backend is alive!");
});

app.post("/a2u-test", async (req, res) => {
  const { uid, amount } = req.body;
  const memo = "A2U-test-001";

  if (!uid || !amount) {
    return res.status(400).json({ success: false, message: "Thiếu uid hoặc amount" });
  }

  console.log("🔍 A2U REQUEST:");
  console.log("📌 UID:", uid);
  console.log("📌 AMOUNT:", amount);
  console.log("📌 MEMO:", memo);

  const axiosClient = axios.create({
    baseURL: "https://api.testnet.minepi.com",
    timeout: 15000,
    headers: {
      Authorization: `Key ${PI_API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  try {
    const paymentRes = await axiosClient.post("/v2/payments", {
      amount,
      memo,
      metadata: { note: "A2U payment from app" },
      uid
    });

    const paymentIdentifier = paymentRes.data.identifier;
    const recipientAddress = paymentRes.data.recipient;

    if (!paymentIdentifier || !recipientAddress) {
      return res.status(500).json({ success: false, message: "Thiếu thông tin từ Pi API" });
    }

    const sourceAccount = await server.loadAccount(APP_PUBLIC_KEY);
    const baseFee = await server.fetchBaseFee();
    const timebounds = await server.fetchTimebounds(180);

    const operation = Operation.payment({
      destination: recipientAddress,
      asset: Asset.native(),
      amount: amount.toString()
    });

    const tx = new TransactionBuilder(sourceAccount, {
      fee: baseFee.toString(),
      networkPassphrase: "Pi Testnet",
      timebounds
    })
      .addOperation(operation)
      .addMemo(Memo.text(memo))
      .build();

    const keypair = Keypair.fromSecret(APP_PRIVATE_KEY);
    tx.sign(keypair);

    const txResult = await server.submitTransaction(tx);
    const txid = txResult.id;

    await axiosClient.post(`/v2/payments/${paymentIdentifier}/complete`, { txid });

    return res.json({ success: true, txid });
  } catch (error: any) {
    console.error("❌ Lỗi xử lý A2U:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi xử lý A2U",
      error: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Pi A2U backend running on port ${PORT}`);
});
