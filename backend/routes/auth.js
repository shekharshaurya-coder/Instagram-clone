// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

// signup
router.post('/signup', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) return res.status(400).json({ message: 'Missing fields' });

    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    if (await User.findOne({ username })) return res.status(400).json({ message: 'Username taken' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, username, password: hashed });
    await user.save();

    // return user (without password)
    const out = {
      id: user._id,
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url,
    };
    res.status(201).json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });

    const user = await User.findOne({ email });
    if (!user) {
      // match your frontend expectation: 404 -> redirect to signup
      return res.status(404).json({ message: 'Account not found' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const payload = { sub: user._id.toString(), username: user.username };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // return token under "token" key (your frontend expects body.token)
    res.json({
      token,
      redirect: '/index.html' // optional: adjust as you want
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
