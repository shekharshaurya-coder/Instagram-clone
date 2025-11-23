// models/follow.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./Counter");

const FollowSchema = new Schema({
  followId: { type: Number, unique: true },     // AUTO INCREMENT

  follower: { type: Types.ObjectId, ref: "User", required: true },
  followee: { type: Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

FollowSchema.index({ follower: 1, followee: 1 }, { unique: true });

FollowSchema.pre("save", async function(next) {
  if (this.followId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "followId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.followId = counter.value;
  next();
});

module.exports = model("Follow", FollowSchema);
