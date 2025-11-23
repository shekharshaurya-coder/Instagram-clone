// server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");
const connectDB = require('./db');

// ============== INITIALIZE APP ==============
const app = express();
app.use(express.json());

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ============== CONNECT DATABASE ==============
connectDB();

// ============== AUTH ROUTES ==============

// SIGNUP
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

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

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
    res.status(500).json({ message: "Server error" });
  }
});

// ============== USER ROUTES ==============

// GET current user
app.get("/api/users/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash");
    if (!user) 
      return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      userId: user.userId,
      username: user.username,
      displayName: user.displayName || user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// SEARCH USERS
app.get("/api/users/search", auth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json([]);
    }

    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('username displayName avatarUrl followersCount')
    .limit(10)
    .lean();

    res.json(users.map(u => ({
      id: u._id,
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarUrl,
      followersCount: u.followersCount || 0
    })));
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// FOLLOW USER
app.post("/api/users/:userId/follow", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const Follow = require('./models/Follow');
    
    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId: req.user._id,
      followingId: targetUserId
    });

    if (existingFollow) {
      return res.status(400).json({ message: "Already following this user" });
    }

    // Create follow relationship
    await Follow.create({
      followerId: req.user._id,
      followingId: targetUserId
    });

    // Update counts
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });

    res.json({ message: "Followed successfully", following: true });
  } catch (err) {
    console.error('Follow user error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// UNFOLLOW USER
app.delete("/api/users/:userId/follow", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const Follow = require('./models/Follow');

    const result = await Follow.findOneAndDelete({
      followerId: req.user._id,
      followingId: targetUserId
    });

    if (!result) {
      return res.status(400).json({ message: "Not following this user" });
    }

    // Update counts
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });

    res.json({ message: "Unfollowed successfully", following: false });
  } catch (err) {
    console.error('Unfollow user error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// CHECK IF FOLLOWING
app.get("/api/users/:userId/following", auth, async (req, res) => {
  try {
    const Follow = require('./models/Follow');
    
    const follow = await Follow.findOne({
      followerId: req.user._id,
      followingId: req.params.userId
    });

    res.json({ following: !!follow });
  } catch (err) {
    console.error('Check following error:', err);
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

    const updated = await User.findByIdAndUpdate(
      req.user._id, 
      updates, 
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updated) 
      return res.status(404).json({ message: "User not found" });

    res.json({
      id: updated._id,
      userId: updated.userId,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      bio: updated.bio,
      avatarUrl: updated.avatarUrl,
      followersCount: updated.followersCount || 0,
      followingCount: updated.followingCount || 0
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============== POST ROUTES ==============

// CREATE POST
app.post("/api/posts", auth, async (req, res) => {
  try {
    const { content, type, mediaUrl } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: "Content is required" });
    }

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
      mediaUrl: newPost.mediaUrl,
      timestamp: "Just now",
      likes: 0,
      comments: 0
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET FEED
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
    console.error('Get feed error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// LIKE/UNLIKE POST
app.post("/api/posts/:postId/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    
    const likeIndex = post.likes.findIndex(
      id => id.toString() === req.user._id.toString()
    );
    
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(req.user._id);
    }
    
    await post.save();
    
    res.json({ 
      likes: post.likes.length, 
      liked: likeIndex === -1 
    });
  } catch (err) {
    console.error('Like post error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============== ANALYTICS ROUTES ==============

app.get('/api/analytics', auth, async (req, res) => {
  try {
    const users = await User.find({}, 'username followersCount').lean();
    const analytics = users.map(u => ({
      username: u.username,
      followerCount: u.followersCount || 0
    }));
    res.json({ ok: true, analytics });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ============== HELPER FUNCTIONS ==============

function formatTimestamp(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

// ============== START SERVER ==============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));