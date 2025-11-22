// models/hashtag.js
const { Schema, model } = require("mongoose");
const Counter = require("./counter");

const HashtagSchema = new Schema({
  hashtagId: { type: Number, unique: true }, // AUTO INCREMENT

  tag: { type: String, required: true, unique: true },
  postsCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
});

HashtagSchema.pre("save", async function(next) {
  if (this.hashtagId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "hashtagId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.hashtagId = counter.value;
  next();
});

module.exports = model("Hashtag", HashtagSchema);
