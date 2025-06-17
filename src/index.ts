import express from "express";
import dotenv from "dotenv";
import { Server, Keypair, Asset, Operation, TransactionBuilder, Memo } from "@stellar/stellar-sdk";
import axios from "axios";

dotenv.config();
const app = express();
app.use(express.json());

const PI_API_KEY = process.env.PI_API_KEY!;
const APP_PUBLIC_KEY = process.env.APP_PUBLIC_KEY!;
const APP_PRIVATE_KEY = process.env.APP_PRIVATE_KEY!;
const BASE_URL = "https://api.testnet.minepi.com";

const server = new Server(BASE_URL);

const axiosClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Key ${PI_API_KEY}`,
    "Content-Type": "application/json",
  },
});

app.get("/", (_, res) => {
  res.send("✅ Pi A2U backend is running.");
});

app.post("/api/a2u-test", async (req, res) => {
  const { uid, amount } = req.body;
  const memo = "A2U-test-001";

  if (!uid || !amount) {
    return res.status(400).json({ success: false, message: "Thiếu uid hoặc amount" });
  }

  console.log("🔍 A2U REQUEST:");
  console.log("📌 UID:", uid);
  console.log("📌 AMOUNT:", amount);
  console.log("📌 MEMO:", memo);
  console.log("📌 PI_API_KEY starts with:", PI_API_KEY.slice(0, 6));

  try {
    const body = {
      uid,
      amount,
      memo,
      metadata: { note: "test" },
    };

    console.log("📤 Sending to Pi API /v2/payments ...");
    const createRes = await axiosClient.post("/v2/payments", body);

    const paymentIdentifier = createRes.data.identifier;
    const recipientAddress = createRes.data.recipient;

    if (!paymentIdentifier || !recipientAddress) {
      return res.status(500).json({ success: false, message: "Không có identifier hoặc recipient" });
    }

    const sourceAccount = await server.loadAccount(APP_PUBLIC_KEY);
    const baseFee = await server.fetchBaseFee();
    const timebounds = await server.fetchTimebounds(180);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: baseFee.toString(),
      networkPassphrase: "Pi Testnet",
      timebounds,
    })
      .addOperation(Operation.payment({
        destination: recipientAddress,
        asset: Asset.native(),
        amount: amount.toString(),
      }))
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
      error: error.response?.data || error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("🚀 Pi A2U backend đang chạy tại cổng 3000");
});