// models/user.js
const { Schema, model } = require("mongoose");
const Counter = require("./counter");

const UserSchema = new Schema({
  userId: { type: Number, unique: true },   // AUTO INCREMENT ID
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },

  displayName: { type: String, default: "" },
  bio: { type: String, default: "" },
  avatarUrl: { type: String, default: "" },

  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
}, { timestamps: true });


// ⭐ AUTO-INCREMENT MIDDLEWARE ⭐
UserSchema.pre("save", async function (next) {
  if (this.userId) {
    return next(); // already set (updating existing user)
  }

  try {
    const counter = await Counter.findOneAndUpdate(
      { name: "userId" },
      { $inc: { value: 1 } },
      { upsert: true, new: true }
    );

    this.userId = counter.value; // Assign new auto increment ID
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = model("User", UserSchema);
