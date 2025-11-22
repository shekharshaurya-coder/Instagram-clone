// models/post.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./counter");

const PostSchema = new Schema({
  postId: { type: Number, unique: true },  // AUTO INCREMENT

  author: { type: Types.ObjectId, ref: "User", required: true, index: true },
  caption: { type: String, default: "" },

  media: [{
    url: String,
    type: { type: String, enum: ["image", "video"], default: "image" },
    width: Number,
    height: Number,
    duration: Number,
  }],

  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  hashtags: [{ type: String }],

}, { timestamps: true });

PostSchema.pre("save", async function(next) {
  if (this.postId) return next();
  
  const counter = await Counter.findOneAndUpdate(
    { name: "postId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.postId = counter.value;
  next();
});

module.exports = model("Post", PostSchema);
