// server.js - KEVIN TRADE HUB - FINAL na KYC + BALANCE
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({dest:'uploads/'});
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// ===== 1. CONNECT MONGODB =====
mongoose.connect('mongodb+srv://YOUR_MONGO_URL_HERE', {
  // weka connection string yako hapa ya Atlas
}).then(()=>console.log('✅ Mongo Connected')).catch(e=>console.log(e));

// ===== 2. HAPA NDIPO USER SCHEMA IKO - USI-FUTE HII =====
const UserSchema = new mongoose.Schema({
  phone: {type:String, unique:true}, // hii ndio username yako 254...
  password: String,
  balance: {type:Number, default:0}, // <-- BALANCE YA MTU

  // KYC FIELDS - HIZI NDIZO MPYA
  idNumber: String,
  kycStatus: {type:String, default:'not_verified'}, // not_verified, pending, approved, rejected
  kycFrontUrl: String,
  kycBackUrl: String,

  createdAt: {type:Date, default:Date.now}
});

const User = mongoose.model('User', UserSchema);
// ===== SCHEMA INAISHIA HAPA =====

// ===== 3. DARAJA M-PESA CONFIG YAKO (yako ya zamani) =====
const consumer_key = "YOUR_CONSUMER_KEY";
const consumer_secret = "YOUR_CONSUMER_SECRET";
const shortcode = "YOUR_SHORTCODE";
const passkey = "YOUR_PASSKEY";

async function getToken(){
  let auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64');
  let res = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers:{Authorization:`Basic ${auth}`}
  });
  return res.data.access_token;
}

// ===== 4. ROUTES ZAKO ZOTE =====

// Signup
app.post('/api/signup', async (req,res)=>{
  try{
    let {phone, password} = req.body;
    let exists = await User.findOne({phone});
    if(exists) return res.json({success:false, msg:'User exists'});
    let user = await User.create({phone, password});
    res.json({success:true, user});
  }catch(e){ res.json({success:false, msg:e.message}) }
});

// Login
app.post('/api/login', async (req,res)=>{
  try{
    let {phone, password} = req.body;
    let user = await User.findOne({phone, password});
    if(!user) return res.json({success:false, msg:'Wrong credentials'});
    res.json({success:true, user});
  }catch(e){ res.json({success:false}) }
});

// Get All Users for Admin
app.get('/api/users', async (req,res)=>{
  try{
    let users = await User.find().sort({createdAt:-1});
    res.json({success:true, users});
  }catch(e){ res.json({success:false}) }
});

// Delete User
app.delete('/api/users/:id', async (req,res)=>{
  try{ await User.findByIdAndDelete(req.params.id); res.json({success:true}); }catch(e){res.json({success:false})}
});

// ===== 5. BALANCE LIVE - KWA DASHBOARD & WALLET =====
app.get('/api/balance/:phone', async (req,res)=>{
  try{
    let user = await User.findOne({phone:req.params.phone});
    res.json({success:true, balance: user ? user.balance||0 : 0});
  }catch(e){ res.json({success:false, balance:0}) }
});

app.post('/api/admin/add-balance', async (req,res)=>{
  try{
    let {userId, amount} = req.body;
    let user = await User.findById(userId);
    user.balance = (user.balance||0) + Number(amount);
    await user.save();
    res.json({success:true, newBalance:user.balance});
  }catch(e){ res.json({success:false, msg:e.message}) }
});

// ===== 6. KYC ROUTES =====
app.post('/api/kyc/upload', upload.fields([{name:'front'},{name:'back'}]), async (req,res)=>{
 try{
  let {phone, idNumber} = req.body;
  let user = await User.findOne({phone});
  if(!user) return res.json({success:false, msg:'User not found'});
  user.idNumber = idNumber;
  user.kycStatus = 'pending';
  if(req.files['front']) user.kycFrontUrl = req.files['front'][0].path;
  if(req.files['back']) user.kycBackUrl = req.files['back'][0].path;
  await user.save();
  res.json({success:true});
 }catch(e){ res.json({success:false, msg:e.message}) }
});

app.get('/api/kyc/:phone', async (req,res)=>{
  try{
    let user = await User.findOne({phone:req.params.phone});
    if(!user) return res.json({success:false});
    res.json({success:true, kyc:{idNumber:user.idNumber, status:user.kycStatus||'not_verified', front:user.kycFrontUrl, back:user.kycBackUrl}});
  }catch(e){ res.json({success:false}) }
});

app.post('/api/admin/kyc-approve', async (req,res)=>{
  try{
    let {userId, status} = req.body;
    let user = await User.findById(userId);
    user.kycStatus = status; // approved / rejected
    await user.save();
    res.json({success:true});
  }catch(e){ res.json({success:false, msg:e.message}) }
});

// ===== 7. M-PESA DEPOSIT & WITHDRAW (yako ya zamani) =====
app.post('/deposit', async (req,res)=>{
  try{
    let {phone, amount} = req.body;
    let token = await getToken();
    let timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    let password = Buffer.from(shortcode+passkey+timestamp).toString('base64');
    let resp = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',{
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: "https://tradehub-ke.onrender.com/callback",
      AccountReference: "KEVINHUB",
      TransactionDesc: "Deposit"
    },{headers:{Authorization:`Bearer ${token}`}});
    res.json({success:true, data:resp.data});
  }catch(e){ res.json({success:false, error:e.response?.data||e.message}) }
});

app.post('/withdraw', async (req,res)=>{
  res.json({success:true, msg:'Withdraw processing'});
});

app.post('/callback', async (req,res)=>{
  console.log('Callback', req.body);
  res.json({success:true});
});

// ===== 8. START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Server running on '+PORT));