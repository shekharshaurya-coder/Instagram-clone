// server.js
// making the basic for now , with time we will append things to this 
require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");

/// and signup 
// SIGNUP: Create user
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password)
      return res.status(400).json({ message: "Missing fields" });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already registered" });

    if (await User.findOne({ username }))
      return res.status(400).json({ message: "Username taken" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      username,
      password: hashed
    });

    return res.status(201).json({
      id: newUser._id,
      email: newUser.email,
      username: newUser.username
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
/////////////////////////////
//loign
// LOGIN: Validate credentials & return JWT
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "Account not found" }); // your frontend expects 404

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ message: "Incorrect password" });

    // Create JWT
    const token = jwt.sign(
      { sub: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      redirect: "/index.html"   // your login.html expects this field
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//ending login and signup

//now route to me , 
// GET current user
app.get("/api/users/me", auth, async (req, res) => {
  res.json(req.user); // Already cleaned by middleware
});
///////////////////////////////


////update profile 
// UPDATE PROFILE
app.put("/api/users/me", auth, async (req, res) => {
  try {
    const allowed = ["bio", "avatar_url", "username"];
    const updates = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    const updated = await User.findById(req.user._id).select("-password");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
////////////////
//ending updatad profile 
























































const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// connect mongoose
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=> console.log('Mongo connected'))
  .catch(err => console.error('Mongo connection error:', err));

// API: example analytics data
// adapt query to your schema: here we fetch follower counts per user
app.get('/api/analytics', async (req, res) => {
  try {
    // Example: assume User model has { username: String, followers: [userId,...] }
    // Return each user and their follower count
    const users = await User.find({}, 'username followers').lean();
    const analytics = users.map(u => ({
      username: u.username,
      followerCount: Array.isArray(u.followers) ? u.followers.length : 0
    }));
    res.json({ ok: true, analytics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});
/// shekhar 
/// there is an error in the path name , that we will see later when we actually need it 

// Optional: serve analytics page explicitly (static folder already handles it)
app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server listening on ${PORT}`));
