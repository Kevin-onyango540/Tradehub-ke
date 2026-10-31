const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const upload = multer({dest:'uploads/'});
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));

const MONGO = process.env.MONGO_URL || "mongodb+srv://kevoh:kevoh123@cluster0.xxxx.mongodb.net/tradehub?retryWrites=true&w=majority";
mongoose.connect(MONGO).then(()=>console.log("✅ Mongo Connected")).catch(e=>console.log("Mongo Error",e.message));

const UserSchema = new mongoose.Schema({
  phone: {type:String, unique:true, lowercase:true},
  password: String,
  balance: {type:Number, default:0},
  idNumber: String,
  kycStatus: {type:String, default:'not_verified'},
  kycFrontUrl: String,
  kycBackUrl: String,
  createdAt: {type:Date, default:Date.now}
});
const User = mongoose.model('User', UserSchema);

app.post('/api/signup', async (req,res)=>{
  try{
    let phone=(req.body.phone||'').toLowerCase().trim();
    let password=(req.body.password||'').trim();
    if(!phone||!password) return res.json({success:false,msg:'Weka data'});
    let exists=await User.findOne({phone});
    if(exists) return res.json({success:false,msg:'User exists'});
    let user=await User.create({phone,password});
    res.json({success:true,user});
  }catch(e){ res.json({success:false,msg:e.message}); }
});

app.post('/api/login', async (req,res)=>{
  try{
    let phone=(req.body.phone||'').toLowerCase().trim();
    let password=(req.body.password||'').trim();
    let user=await User.findOne({phone,password});
    if(!user) return res.json({success:false,msg:'Wrong credentials'});
    res.json({success:true,user});
  }catch(e){ res.json({success:false,msg:e.message}); }
});

app.get('/api/users', async (req,res)=>{ let users=await User.find().sort({createdAt:-1}); res.json({success:true,users}); });
app.delete('/api/users/:id', async (req,res)=>{ await User.findByIdAndDelete(req.params.id); res.json({success:true}); });
app.get('/api/balance/:phone', async (req,res)=>{ let u=await User.findOne({phone:req.params.phone.toLowerCase()}); res.json({success:true,balance:u?.balance||0}); });
app.post('/api/admin/add-balance', async (req,res)=>{ let u=await User.findById(req.body.userId); u.balance=(u.balance||0)+Number(req.body.amount); await u.save(); res.json({success:true}); });
app.post('/api/kyc/upload', upload.fields([{name:'front'},{name:'back'}]), async (req,res)=>{ let phone=(req.body.phone||'').toLowerCase(); let u=await User.findOne({phone}); u.idNumber=req.body.idNumber; u.kycStatus='pending'; if(req.files['front'])u.kycFrontUrl=req.files['front'][0].path; if(req.files['back'])u.kycBackUrl=req.files['back'][0].path; await u.save(); res.json({success:true}); });
app.get('/api/kyc/:phone', async (req,res)=>{ let u=await User.findOne({phone:req.params.phone.toLowerCase()}); res.json({success:true,kyc:{idNumber:u?.idNumber,status:u?.kycStatus||'not_verified'}}); });
app.post('/api/admin/kyc-approve', async (req,res)=>{ let u=await User.findById(req.body.userId); u.kycStatus=req.body.status; await u.save(); res.json({success:true}); });
app.post('/deposit', (req,res)=>res.json({success:true,data:{CheckoutRequestID:'DEMO'}}));
app.post('/withdraw', (req,res)=>res.json({success:true}));
app.post('/callback', (req,res)=>res.json({success:true}));

app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// HII NDIO FIX - USITUMIE app.get('*')
app.use((req,res)=>{
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT=process.env.PORT||10000;
app.listen(PORT, ()=>console.log('✅ Server running on '+PORT));