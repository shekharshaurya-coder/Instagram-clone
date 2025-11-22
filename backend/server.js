// server.js
// Uploaded file (image) path: /mnt/data/afeccbed-8c55-4e8c-9788-7d686d47cb43.png

require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");
const connectDB = require('./db');

// ============== INITIALIZE APP FIRST ==============
const app = express();
app.use(express.json());

// Serve static files from frontend folder (one level up, then into frontend)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ============== CONNECT MONGOOSE ==============
connectDB();

// ============== AUTH ROUTES ==============

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
      passwordHash: hashed,
      displayName: username,
      bio: "",
      avatarUrl: ""
    });

    const token = jwt.sign(
      { sub: newUser._id.toString(), userId: newUser.userId, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      id: newUser._id,
      userId: newUser.userId,
      email: newUser.email,
      username: newUser.username,
      token
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// LOGIN: Validate credentials & return JWT
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('Login attempt:', { username });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(404).json({ message: "Account not found" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign(
      { 
        sub: user._id.toString(), 
        userId: user.userId,
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ============== USER ROUTES ==============

// GET current user
app.get("/api/users/me", auth, async (req, res) => {
  try {
    // auth middleware should populate req.user with at least _id
    const user = await User.findById(req.user._id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      userId: user.userId,
      username: user.username,
      displayName: user.displayName || user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount: user.followersCount,
      followingCount: user.followingCount
    });
  } catch (err) {
    console.error('GET /api/users/me error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE PROFILE
app.put("/api/users/me", auth, async (req, res) => {
  try {
    const allowed = ["bio", "avatarUrl", "displayName", "username"];
    const updates = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    const updated = await User.findById(req.user._id).select("-passwordHash");

    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json({
      id: updated._id,
      userId: updated.userId,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      bio: updated.bio,
      avatarUrl: updated.avatarUrl,
      followersCount: updated.followersCount,
      followingCount: updated.followingCount
    });
  } catch (err) {
    console.error('PUT /api/users/me error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============== POST/FEED ROUTES ==============

// CREATE POST
app.post("/api/posts", auth, async (req, res) => {
  try {
    const { content, type, mediaUrl } = req.body;
    
    const newPost = await Post.create({
      userId: req.user._id,
      username: req.user.username,
      content,
      type: type || 'text',
      mediaUrl: mediaUrl || null,
      likes: [],
      comments: []
    });
    
    res.status(201).json({
      id: newPost._id,
      username: newPost.username,
      displayName: newPost.username,
      avatar: "👤",
      content: newPost.content,
      timestamp: "Just now",
      likes: 0,
      comments: 0
    });
  } catch (err) {
    console.error('POST /api/posts error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET USER FEED (all posts, newest first)
app.get("/api/posts/feed", auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    const formattedPosts = posts.map(post => ({
      id: post._id,
      username: post.username,
      displayName: post.username,
      avatar: "👤",
      content: post.content,
      mediaUrl: post.mediaUrl,
      timestamp: formatTimestamp(post.createdAt),
      likes: Array.isArray(post.likes) ? post.likes.length : 0,
      comments: Array.isArray(post.comments) ? post.comments.length : 0
    }));
    
    res.json(formattedPosts);
  } catch (err) {
    console.error('GET /api/posts/feed error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// LIKE POST
app.post("/api/posts/:postId/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const likeIndex = post.likes.findIndex(id => id.toString() === req.user._id.toString());
    
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(req.user._id);
    }
    
    await post.save();
    
    res.json({ likes: post.likes.length, liked: likeIndex === -1 });
  } catch (err) {
    console.error('POST /api/posts/:postId/like error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// Helper function to format timestamps
function formatTimestamp(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000); // seconds
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

// ============== ANALYTICS ROUTES ==============

// API: analytics data (fixed to use followersCount)
app.get('/api/analytics', auth, async (req, res) => {
  try {
    // Use followersCount stored on User model
    const users = await User.find({}, 'username followersCount').lean();
    const analytics = users.map(u => ({
      username: u.username,
      followerCount: typeof u.followersCount === 'number' ? u.followersCount : 0
    }));
    res.json({ ok: true, analytics });
  } catch (err) {
    console.error('GET /api/analytics error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Serve analytics page (static file location - adjust as needed)
app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
});

// ============== START SERVER ==============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

// ============== TEST ROUTE - Create Test User ==============
// REMOVE THIS AFTER TESTING
app.get('/api/create-test-user', async (req, res) => {
  try {
    const existing = await User.findOne({ username: 'testuser' });
    if (existing) {
      return res.json({ 
        message: 'Test user already exists!',
        credentials: {
          username: 'testuser',
          password: 'test123'
        }
      });
    }

    const hashed = await bcrypt.hash('test123', 10);
    const testUser = await User.create({
      email: 'test@socialsync.com',
      username: 'testuser',
      passwordHash: hashed,
      displayName: 'Test User',
      bio: 'This is a test account for SocialSync',
      avatarUrl: ''
    });

    res.json({ 
      message: 'Test user created successfully!',
      user: {
        userId: testUser.userId,
        username: testUser.username,
        email: testUser.email,
        displayName: testUser.displayName
      },
      credentials: {
        username: 'testuser',
        password: 'test123'
      }
    });
  } catch (err) {
    console.error('GET /api/create-test-user error:', err);
    res.status(500).json({ error: err.message });
  }
});
