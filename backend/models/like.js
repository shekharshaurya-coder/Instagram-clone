// models/like.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./counter");

const LikeSchema = new Schema({
  likeId: { type: Number, unique: true },   // AUTO INCREMENT

  post: { type: Types.ObjectId, ref: "Post", required: true },
  user: { type: Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

LikeSchema.index({ post: 1, user: 1 }, { unique: true });

LikeSchema.pre("save", async function(next) {
  if (this.likeId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "likeId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.likeId = counter.value;
  next();
});

module.exports = model("Like", LikeSchema);
