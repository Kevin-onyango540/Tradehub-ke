const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// === WEKA HAPA KEYS ZAKO ===
const CONSUMER_KEY = "rTG5uILxfGlvdopjNVGVZtcM9eKtYp71a2PW1FlXItJXbPfP"; // weka key yako kamili uliyo-copy
const CONSUMER_SECRET = "SO8eX3X0V11HTG7ktLyxz67pm8QNHICFlvThKGt1sQipkUXWATK6o5uooqsfz4IR"; // weka secret yako kamili
const SHORTCODE = "174379";
const PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const SECURITY_CRED = "geWcxfFshPGcdKHx0cGm3ANuFGb7RW8ei7QpKsrA2E/OsDCihxHyGdO7J/kKyZnNbOxywms3WDp3wFtyLxro/Xn61rou3k7Zb4aJAXu/hXfay3VIFv+Two6jTKksHfXFG5cqg5ggLfBJcouWfIqM/LZSFj/L8RXgyGhtEzB8TLAOFxtGDaz/WVEzOhaIVrtx5SXbtxm2p4gyvUp6ZlIEYcKkEvDnCnTPQKiEtw7IqctTCTxv/PnE7p7vU9i9OaRrTHwVGU5rtNkyJR8fT8fP9sHRyHoGjlXoPIF8VFBmTUSpW5eHJ35LIkhK+a0TSNJSFGAufLqXEvInFNCWqAGjxg=="; // weka ile ndefu uliyo-generate hapa - TOA hizo "" 
const INITIATOR = "testapi";
// ============================

async function getToken(){
  const auth = Buffer.from(CONSUMER_KEY+":"+CONSUMER_SECRET).toString('base64');
  const res = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",{headers:{Authorization:"Basic "+auth}});
  return res.data.access_token;
}

// 1. DEPOSIT - STK PUSH
app.post('/deposit', async (req,res)=>{
  try{
    const token = await getToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    const password = Buffer.from(SHORTCODE+PASSKEY+timestamp).toString('base64');
    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: req.body.amount || 100,
      PartyA: req.body.phone,
      PartyB: SHORTCODE,
      PhoneNumber: req.body.phone,
      CallBackURL: "https://mydomain.com/callback",
      AccountReference: "TradeHub",
      TransactionDesc: "Deposit"
    };
    const resp = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", payload, {headers:{Authorization:"Bearer "+token}});
    console.log("STK sent to", req.body.phone);
    res.json({success:true, data:resp.data});
  }catch(e){ console.log(e.response?.data); res.json({success:false, error:e.response?.data || e.message}); }
});

// 2. WITHDRAWAL - B2C
app.post('/withdraw', async (req,res)=>{
  try{
    const token = await getToken();
    const payload = {
      InitiatorName: INITIATOR,
      SecurityCredential: SECURITY_CRED,
      CommandID: "BusinessPayment",
      Amount: req.body.amount,
      PartyA: SHORTCODE,
      PartyB: req.body.phone,
      Remarks: "TradeHub Withdrawal",
      QueueTimeOutURL: "https://mydomain.com/timeout",
      ResultURL: "https://mydomain.com/result",
      Occassion: "Withdraw"
    };
    const resp = await axios.post("https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest", payload, {headers:{Authorization:"Bearer "+token}});
    console.log("WITHDRAW", req.body.amount, "to", req.body.phone);
    res.json({success:true, msg:"Withdrawal in process"});
  }catch(e){ console.log(e.response?.data); res.json({success:false, error:e.response?.data || e.message}); }
});

app.get('/', (req,res)=>res.send('TradeHub Backend LIVE ✅ - /deposit & /withdraw ready'));

const PORT = process.env.PORT || 10000
app.listen(PORT, '0.0.0.0', ()=> {console.log(`✅ Backend LIVE on port ${PORT}`)});