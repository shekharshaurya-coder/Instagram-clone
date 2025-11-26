// server.js - FIXED VERSION
require('dotenv').config();
const path = require('path');
const express = require('express');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");
const connectDB = require('./db');
const Sentiment = require('sentiment');
const sentimentAnalyzer = new Sentiment();
const mongoose = require('mongoose');
const { Types: { ObjectId } } = mongoose;
const Follow = require('./models/Follow');
const { Server } = require('socket.io');
const http = require('http');  
const { Types } = require('mongoose');
//const authRoutes = require("./routes/auth.cjs");
const notificationsRouter = require('./routes/notifications'); // path you chose
const messagesRouter = require('./routes/messages');




// ============== INITIALIZE APP ==============
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static("frontend"));
//app.use("/api/auth", authRoutes);
app.use('/api/notifications', notificationsRouter);

// if using socket.io, attach io to app so routes can emit



// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files from frontend folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ============== CONNECT DATABASE ==============
connectDB();

// ============== AUTH ROUTES ==============
//socket io
 const server = http.createServer(app);  // ✅ ADD THIS

// ✅ ADD SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('io', io); // after io created



app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Enable CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
//for messages 
app.use('/api', messagesRouter);
app.use('/api/conversations', auth, messagesRouter);  // ensure auth is used here
//following list end points 


// ==============================
// GET FOLLOWERS OF A USER
// ==============================
// GET followers (users who follow :id) with followerCount
app.get('/api/users/:id/followers', async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('[route] GET /api/users/:id/followers ->', userId);

    const followDocs = await Follow.find({ followee: userId })
      .populate('follower', 'username name avatarUrl');

    if (!followDocs || followDocs.length === 0) {
      return res.json([]);
    }

    const userIds = followDocs
      .map(f => f.follower && f.follower._id)
      .filter(Boolean)
      .map(id => id.toString());

    const counts = await Follow.aggregate([
      { $match: { followee: { $in: userIds.map(id => new  Types.ObjectId(id)) } } },
      { $group: { _id: '$followee', count: { $sum: 1 } } }
    ]);

    const countMap = counts.reduce((m, c) => { m[c._id.toString()] = c.count; return m; }, {});

    const followers = followDocs.map(f => {
      const u = f.follower;
      return {
        id: u._id,
        username: u.username,
        name: u.name,
        avatarUrl: u.avatarUrl || null,
        followerCount: countMap[u._id.toString()] || 0
      };
    });

    return res.json(followers);
  } catch (err) {
    console.error('Error in /api/users/:id/followers:', err);
    // dev-only: send stack for quick debugging; remove in prod
    return res.status(500).json({ error: 'Server error', message: err.message, stack: err.stack });
  }
});

app.get('/api/users/:id/following-list', async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('[route] GET /api/users/:id/following-list ->', userId);

    const followDocs = await Follow.find({ follower: userId })
      .populate('followee', 'username name avatarUrl');

    if (!followDocs || followDocs.length === 0) {
      return res.json([]);
    }

    const userIds = followDocs
      .map(f => f.followee && f.followee._id)
      .filter(Boolean)
      .map(id => id.toString());

    const counts = await Follow.aggregate([
      { $match: { followee: { $in: userIds.map(id =>new Types.ObjectId(id)) } } },
      { $group: { _id: '$followee', count: { $sum: 1 } } }
    ]);

    const countMap = counts.reduce((m, c) => { m[c._id.toString()] = c.count; return m; }, {});

    const following = followDocs.map(f => {
      const u = f.followee;
      return {
        id: u._id,
        username: u.username,
        name: u.name,
        avatarUrl: u.avatarUrl || null,
        followerCount: countMap[u._id.toString()] || 0
      };
    });

    return res.json(following);
  } catch (err) {
    console.error('Error in /api/users/:id/following-list:', err);
    // dev-only: send stack for quick debugging; remove in prod
    return res.status(500).json({ error: 'Server error', message: err.message, stack: err.stack });
  }
});


// Serve static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Connect to database
connectDB();

// ============== SOCKET.IO AUTHENTICATION ==============
// Store connected users: { userId: socketId }
const connectedUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.sub;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// ============== SOCKET.IO CONNECTIONS ==============
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.username, 'Socket ID:', socket.id);
  
  // Store user's socket ID
  connectedUsers.set(socket.userId, socket.id);
  
  // Notify user is online
  socket.broadcast.emit('user_online', { userId: socket.userId, username: socket.username });
  
  // Send list of online users
  const onlineUsers = Array.from(connectedUsers.keys());
  io.emit('online_users', onlineUsers);
  
  // Join user's personal room
  socket.join(socket.userId);
  
  // Handle typing indicator
  socket.on('typing', (data) => {
    const recipientSocketId = connectedUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        isTyping: data.isTyping
      });
    }
  });
  
  // Handle new message
  // Handle new message
// Find this section in your server.js (around line 150-200)
// Replace the existing socket.on('send_message') handler with this:

// Handle new message
socket.on('send_message', async (data) => {
  try {
    const Message = require('./models/Message');
    const Notification = require('./models/Notification');
    
    console.log('📤 Sending message from:', socket.username, 'to:', data.recipientId);
    
    // Create conversation ID (sorted user IDs)
    const conversationId = [socket.userId, data.recipientId].sort().join('_');
    
    // Save message to database
    const newMessage = await Message.create({
      conversationId: conversationId,
      sender: socket.userId,
      recipients: [data.recipientId],
      text: data.text,
      deliveredTo: [],
      readBy: []
    });
    
    console.log('✅ Message saved to database:', newMessage._id);
    
    // Populate sender info
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'username displayName avatarUrl')
      .lean();
    
    const messageData = {
      id: populatedMessage._id,
      conversationId: conversationId,
      sender: {
        id: populatedMessage.sender._id,
        username: populatedMessage.sender.username,
        displayName: populatedMessage.sender.displayName || populatedMessage.sender.username,
        avatarUrl: populatedMessage.sender.avatarUrl
      },
      text: populatedMessage.text,
      createdAt: populatedMessage.createdAt,
      delivered: false,
      read: false
    };
    
    // ✅ CREATE NOTIFICATION FOR RECIPIENT
    try {
      const notification = await Notification.create({
        user: data.recipientId,
        actor: socket.userId,
        verb: 'system',
        targetType: 'Message',
        targetId: newMessage._id,
        read: false
      });
      
      console.log('✅ Notification created:', notification._id);
      
      // Emit notification event to recipient
      const recipientSocketId = connectedUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new_notification', {
          type: 'message',
          from: socket.username,
          fromDisplayName: populatedMessage.sender.displayName || socket.username,
          message: data.text.substring(0, 100),
          notificationId: notification._id
        });
      }
    } catch (notifErr) {
      console.error('❌ Failed to create notification:', notifErr);
      // Don't fail the whole message send if notification fails
    }
    
    // Send to sender (confirmation)
    socket.emit('message_sent', messageData);
    
    // Send to recipient if online
    const recipientSocketId = connectedUsers.get(data.recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('new_message', messageData);
      
      // Mark as delivered
      await Message.findByIdAndUpdate(newMessage._id, {
        $addToSet: { deliveredTo: data.recipientId }
      });
      
      socket.emit('message_delivered', { messageId: newMessage._id });
      
      console.log('✅ Message delivered to online recipient');
    } else {
      console.log('📪 Recipient offline - notification will wait');
    }
    
    console.log('📩 Message send complete:', socket.username, '→', data.recipientId);
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    socket.emit('message_error', { error: 'Failed to send message' });
  }
});
  
  // Handle message read
  socket.on('mark_read', async (data) => {
    try {
      const Message = require('./models/Message');
      
      await Message.updateMany(
        {
          conversationId: data.conversationId,
          sender: data.senderId,
          readBy: { $ne: socket.userId }
        },
        {
          $addToSet: { readBy: socket.userId }
        }
      );
      
      // Notify sender that messages were read
      const senderSocketId = connectedUsers.get(data.senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('messages_read', {
          conversationId: data.conversationId,
          readBy: socket.userId
        });
      }
      
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.username);
    connectedUsers.delete(socket.userId);
    
    // Notify user is offline
    socket.broadcast.emit('user_offline', { userId: socket.userId });
    
    // Update online users list
    const onlineUsers = Array.from(connectedUsers.keys());
    io.emit('online_users', onlineUsers);
  });
});

// ============== REST API ROUTES ==============

// GET CONVERSATIONS
app.get('/api/messages/conversations', auth, async (req, res) => {
  try {
    const Message = require('./models/Message');
    
    // Get all conversations where user is involved
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { recipients: req.user._id }
      ]
    })
    .populate('sender', 'username displayName avatarUrl')
    .populate('recipients', 'username displayName avatarUrl')
    .sort({ createdAt: -1 })
    .lean();
    
    // Group by conversation
    const conversationsMap = new Map();
    
    messages.forEach(msg => {
      const convId = msg.conversationId;
      
      if (!conversationsMap.has(convId)) {
        // Find the other user (not current user)
        const otherUser = msg.sender._id.toString() === req.user._id.toString()
          ? msg.recipients[0]
          : msg.sender;
        
        conversationsMap.set(convId, {
          conversationId: convId,
          otherUser: {
            id: otherUser._id,
            username: otherUser.username,
            displayName: otherUser.displayName || otherUser.username,
            avatarUrl: otherUser.avatarUrl
          },
          lastMessage: {
            text: msg.text,
            createdAt: msg.createdAt,
            senderId: msg.sender._id,
            read: msg.readBy.includes(req.user._id)
          },
          unreadCount: 0
        });
      }
    });
    
    // Count unread messages for each conversation
    for (const [convId, conv] of conversationsMap) {
      const unreadCount = await Message.countDocuments({
        conversationId: convId,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      });
      conv.unreadCount = unreadCount;
    }
    
    const conversations = Array.from(conversationsMap.values());
    res.json(conversations);
    
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET MESSAGES FOR A CONVERSATION
app.get('/api/messages/conversation/:userId', auth, async (req, res) => {
  try {
    const Message = require('./models/Message');
    const otherUserId = req.params.userId;
    
    // Create conversation ID
    const conversationId = [req.user._id.toString(), otherUserId].sort().join('_');
    
    // Get all messages in conversation
    const messages = await Message.find({ conversationId })
      .populate('sender', 'username displayName avatarUrl')
      .sort({ createdAt: 1 })
      .lean();
    
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      sender: {
        id: msg.sender._id,
        username: msg.sender.username,
        displayName: msg.sender.displayName || msg.sender.username,
        avatarUrl: msg.sender.avatarUrl
      },
      text: msg.text,
      createdAt: msg.createdAt,
      delivered: msg.deliveredTo.length > 0,
      read: msg.readBy.length > 0,
      isMine: msg.sender._id.toString() === req.user._id.toString()
    }));
    
    res.json(formattedMessages);
    
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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
      avatarUrl: "",
      followersCount: 0,
      followingCount: 0
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
    console.log("===== LOGIN ATTEMPT =====");
    console.log("Username received:", req.body.username);

    const { username, password } = req.body;

    const user = await User.findOne({ username });
    console.log("User found in DB:", !!user);

    if (!user) {
      console.log("❌ No user found");
      return res.status(404).json({ message: "Account not found" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log("Password correct:", ok);

    if (!ok) {
      console.log("❌ Wrong password");
      return res.status(401).json({ message: "Incorrect password" });
    }

    // Generate JWT
    const tokenPayload = {
      sub: user._id.toString(),
      username: user.username
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "7d" });

    console.log("===== TOKEN GENERATED =====");
    console.log("User ID (sub):", tokenPayload.sub);
    console.log("Username:", tokenPayload.username);
    console.log("JWT Token:", token);
    console.log("===========================\n");

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
        bio: user.bio || "",
        avatarUrl: user.avatarUrl || ""
      }
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

//route to check the jwt 
app.get("/debug/jwt", (req, res) => {
  const token = jwt.sign(
    { sub: "USER_ID_HERE", username: "USERNAME_HERE" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token });
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
      _id: { $ne: req.user._id }
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

// FOLLOW USER - FIXED
// REPLACE THE FOLLOW ROUTES IN YOUR server.js WITH THESE FIXED VERSIONS

// ============== FOLLOW/UNFOLLOW ROUTES - FIXED ==============

// FOLLOW USER - FIXED WITH PROPER ERROR HANDLING
// ===== Follow / Unfollow / Check routes (clean, single copy) =====

app.post("/api/users/:userId/follow", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const me = req.user && req.user._id && req.user._id.toString();

    console.log('Follow request:', { by: me, target: targetUserId });

    // validate IDs
    if (!targetUserId || !ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Invalid target user id" });
    }
    if (!me) return res.status(401).json({ message: "Unauthorized" });
    if (me === targetUserId) return res.status(400).json({ message: "Cannot follow yourself" });

    // check target exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ message: "User not found" });

    // Try to create follow (unique index on (follower, followee) should exist)
    try {
      const newFollow = await Follow.create({
        follower: req.user._id,
        followee: targetUserId,
        status: 'accepted'
      });

      // increment counts only after creation
      await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });
      await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });

      // best-effort notification
      try {
        const Notification = require('./models/Notification');
        await Notification.create({
          user: targetUserId,
          actor: req.user._id,
          verb: 'follow',
          targetType: 'User',
          targetId: req.user._id,
          read: false
        });
      } catch (nerr) {
        console.error('Notification creation failed (ignored):', nerr && nerr.message);
      }

      return res.json({ message: "Followed successfully", following: true, followId: newFollow._id });
    } catch (createErr) {
      // duplicate follow (unique index) -> user-friendly response
      if (createErr && createErr.code === 11000) {
        return res.status(400).json({ message: "Already following this user" });
      }
      console.error('Follow create error:', createErr);
      return res.status(500).json({ message: "Server error", error: createErr.message });
    }

  } catch (err) {
    console.error('Follow user error:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.delete("/api/users/:userId/follow", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const me = req.user && req.user._id && req.user._id.toString();

    console.log('Unfollow request:', { by: me, target: targetUserId });

    if (!targetUserId || !ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Invalid target user id" });
    }
    if (!me) return res.status(401).json({ message: "Unauthorized" });

    const deleted = await Follow.findOneAndDelete({
      follower: req.user._id,
      followee: targetUserId
    });

    if (!deleted) {
      return res.status(400).json({ message: "Not following this user" });
    }

    // decrement counts (note: could add clamping later)
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });

    return res.json({ message: "Unfollowed successfully", following: false });
  } catch (err) {
    console.error('Unfollow user error:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.get("/api/users/:userId/following", auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    if (!targetUserId || !ObjectId.isValid(targetUserId)) return res.json({ following: false });

    const follow = await Follow.findOne({
      follower: req.user._id,
      followee: targetUserId
    });

    res.json({ following: !!follow });
  } catch (err) {
    console.error('Check following error:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE PROFILE - FIXED
app.put("/api/users/me", auth, async (req, res) => {
  try {
    const allowed = ["bio", "avatarUrl", "displayName", "username"];
    const updates = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    // Check if username is being changed and if it's already taken
    if (updates.username && updates.username !== req.user.username) {
      const existingUser = await User.findOne({ 
        username: updates.username,
        _id: { $ne: req.user._id }
      });
      
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
    }

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
    res.status(500).json({ message: "Server error", error: err.message });
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

    const user = await User.findById(req.user._id);

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
      displayName: user.displayName || newPost.username,
      avatar: user.avatarUrl || "👤",
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
    
    // Get user details for each post
    const userIds = [...new Set(posts.map(p => p.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id username displayName avatarUrl')
      .lean();
    
    const userMap = {};
    users.forEach(u => {
      userMap[u._id.toString()] = u;
    });
    
    const formattedPosts = posts.map(post => {
      const postUser = userMap[post.userId.toString()] || {};
      return {
        id: post._id,
        username: post.username,
        displayName: postUser.displayName || post.username,
        avatar: postUser.avatarUrl || "👤",
        content: post.content,
        mediaUrl: post.mediaUrl,
        timestamp: formatTimestamp(post.createdAt),
        likes: Array.isArray(post.likes) ? post.likes.length : 0,
        comments: Array.isArray(post.comments) ? post.comments.length : 0,
        liked: Array.isArray(post.likes) && post.likes.some(id => id.toString() === req.user._id.toString())
      };
    });
    
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
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(req.user._id);
      
      // Create notification if liking someone else's post
      if (post.userId.toString() !== req.user._id.toString()) {
        const Notification = require('./models/Notification');
        await Notification.create({
          user: post.userId,
          actor: req.user._id,
          verb: 'like',
          targetType: 'Post',
          targetId: post._id,
          read: false
        });
      }
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

// ============== NOTIFICATION ROUTES ==============

// GET NOTIFICATIONS - FIXED
app.get("/api/notifications", auth, async (req, res) => {
  try {
    const Notification = require('./models/Notification');
    
    const notifications = await Notification.find({ user: req.user._id })
      .populate('actor', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedNotifications = notifications.map(n => ({
      id: n._id,
      verb: n.verb,
      actor: n.actor ? {
        id: n.actor._id,
        username: n.actor.username,
        displayName: n.actor.displayName || n.actor.username,
        avatarUrl: n.actor.avatarUrl
      } : null,
      read: n.read,
      createdAt: n.createdAt
    }));

    res.json(formattedNotifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// MARK NOTIFICATION AS READ - FIXED
app.put("/api/notifications/:notificationId/read", auth, async (req, res) => {
  try {
    const Notification = require('./models/Notification');
    
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Marked as read", notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET UNREAD NOTIFICATION COUNT
app.get("/api/notifications/unread/count", auth, async (req, res) => {
  try {
    const Notification = require('./models/Notification');
    
    const count = await Notification.countDocuments({ 
      user: req.user._id,
      read: false 
    });

    res.json({ count });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============== ANALYTICS ROUTES ==============

app.get('/api/analytics/:period', auth, async (req, res) => {
  try {
    const period = req.params.period;
    const userId = req.user._id;
    
    const now = new Date();
    let startDate, labels, groupBy;
    
    if (period === 'day') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      labels = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      }
      groupBy = 'day';
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      groupBy = 'week';
    } else if (period === 'month') {
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      labels = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
      }
      groupBy = 'month';
    } else {
      return res.status(400).json({ ok: false, error: 'Invalid period' });
    }
    
    const posts = await Post.find({
      userId: userId,
      createdAt: { $gte: startDate }
    })
    .sort({ createdAt: 1 })
    .lean();
    
    const likesData = new Array(labels.length).fill(0);
    
    posts.forEach(post => {
      const postDate = new Date(post.createdAt);
      const likeCount = post.likes ? post.likes.length : 0;
      
      let index;
      if (groupBy === 'day') {
        const daysDiff = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));
        index = 6 - daysDiff;
      } else if (groupBy === 'week') {
        const weeksDiff = Math.floor((now - postDate) / (1000 * 60 * 60 * 24 * 7));
        index = 3 - weeksDiff;
      } else if (groupBy === 'month') {
        const monthsDiff = (now.getFullYear() - postDate.getFullYear()) * 12 + 
                          (now.getMonth() - postDate.getMonth());
        index = 5 - monthsDiff;
      }
      
      if (index >= 0 && index < labels.length) {
        likesData[index] += likeCount;
      }
    });
    
    let positive = 0, negative = 0, neutral = 0;
    
    posts.forEach(post => {
      if (!post.content) {
        neutral++;
        return;
      }
      
      const result = sentimentAnalyzer.analyze(post.content);
      
      if (result.score > 0) positive++;
      else if (result.score < 0) negative++;
      else neutral++;
    });
    
    if (posts.length === 0) {
      positive = 1;
      neutral = 1;
      negative = 1;
    }
    
    let topPost = posts.reduce((max, post) => {
      const postLikes = post.likes ? post.likes.length : 0;
      const maxLikes = max.likes ? max.likes.length : 0;
      return postLikes > maxLikes ? post : max;
    }, posts[0] || null);
    
    if (!topPost) {
      topPost = { content: 'No posts yet', likes: [] };
    }
    
    const hashtagCounts = {};
    posts.forEach(post => {
      const hashtags = (post.content || '').match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      });
    });
    
    let trendingHashtag = { tag: 'No hashtags yet', count: 0 };
    Object.keys(hashtagCounts).forEach(tag => {
      if (hashtagCounts[tag] > trendingHashtag.count) {
        trendingHashtag = { tag, count: hashtagCounts[tag] };
      }
    });
    
    res.json({
      ok: true,
      data: {
        labels: labels,
        likes: likesData,
        sentiment: {
          positive: positive,
          negative: negative,
          neutral: neutral
        },
        topPost: {
          text: topPost.content || 'No posts yet',
          likes: topPost.likes ? topPost.likes.length : 0
        },
        trendingHashtag: trendingHashtag
      }
    });
    
  } catch (err) {
    console.error('GET /api/analytics/:period error:', err);
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
server.listen(PORT, () => console.log(`✅ Server + Socket.IO running on port ${PORT}`));
