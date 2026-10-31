const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const upload = multer({dest:'uploads/'});
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// === DB CONNECT - WEKA LINK YAKO HAPA ===
mongoose.connect('mongodb+srv://kevoh:kevoh123@cluster0.xxx.mongodb.net/tradehub?retryWrites=true&w=majority')
.then(()=>console.log('✅ Mongo Connected')).catch(e=>console.log('❌ Mongo Error', e.message));

// === USER SCHEMA ===
const UserSchema = new mongoose.Schema({
  phone: {type:String, unique:true},
  password: String,
  balance: {type:Number, default:0},
  idNumber: String,
  kycStatus: {type:String, default:'not_verified'},
  kycFrontUrl: String,
  kycBackUrl: String,
  createdAt: {type:Date, default:Date.now}
});
const User = mongoose.model('User', UserSchema);

// === API ROUTES - ZOTE JUU YA STATIC ===

app.post('/api/signup', async (req,res)=>{
  try{
    let phone = req.body.phone?.toLowerCase().trim();
    let password = req.body.password?.trim();
    if(!phone || !password) return res.json({success:false, msg:'Weka phone na password'});
    let exists = await User.findOne({phone});
    if(exists) return res.json({success:false, msg:'User exists'});
    let user = await User.create({phone, password});
    res.json({success:true, user});
  }catch(e){ res.json({success:false, msg:e.message}) }
});

app.post('/api/login', async (req,res)=>{
  try{
    let phone = req.body.phone?.toLowerCase().trim();
    let password = req.body.password?.trim();
    let user = await User.findOne({phone, password});
    if(!user) return res.json({success:false, msg:'Wrong phone or password'});
    res.json({success:true, user});
  }catch(e){ res.json({success:false, msg:e.message}) }
});

app.get('/api/users', async (req,res)=>{
  try{ let users = await User.find().sort({createdAt:-1}); res.json({success:true, users}); }catch(e){ res.json({success:false}) }
});

app.delete('/api/users/:id', async (req,res)=>{
  try{ await User.findByIdAndDelete(req.params.id); res.json({success:true}); }catch(e){res.json({success:false})}
});

app.get('/api/balance/:phone', async (req,res)=>{
  try{
    let phone = req.params.phone.toLowerCase();
    let user = await User.findOne({phone});
    res.json({success:true, balance:user?user.balance||0:0});
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

app.post('/api/kyc/upload', upload.fields([{name:'front'},{name:'back'}]), async (req,res)=>{
 try{
  let phone = req.body.phone?.toLowerCase();
  let idNumber = req.body.idNumber;
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
    let phone = req.params.phone.toLowerCase();
    let user = await User.findOne({phone});
    if(!user) return res.json({success:false});
    res.json({success:true, kyc:{idNumber:user.idNumber, status:user.kycStatus||'not_verified'}});
  }catch(e){ res.json({success:false}) }
});

app.post('/api/admin/kyc-approve', async (req,res)=>{
  try{
    let user = await User.findById(req.body.userId);
    user.kycStatus = req.body.status;
    await user.save();
    res.json({success:true});
  }catch(e){ res.json({success:false}) }
});

// M-PESA
app.post('/deposit', async (req,res)=>{
  res.json({success:true, data:{CheckoutRequestID:'DEMO_'+Date.now()}});
});
app.post('/withdraw', async (req,res)=>{ res.json({success:true}); });
app.post('/callback', async (req,res)=>{ res.json({success:true}); });

// === STATIC FILES - MWISHO KABISA ===
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

app.get('*', (req,res)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({success:false, msg:'API not found: '+req.path});
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Server running on '+PORT));