// models/comment.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./counter");

const CommentSchema = new Schema({
  commentId: { type: Number, unique: true },   // AUTO INCREMENT

  post: { type: Types.ObjectId, ref: "Post", required: true },
  author: { type: Types.ObjectId, ref: "User", required: true },

  text: { type: String, required: true },
  parentComment: { type: Types.ObjectId, ref: "Comment", default: null },

  likesCount: { type: Number, default: 0 },
}, { timestamps: true });

CommentSchema.pre("save", async function(next) {
  if (this.commentId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "commentId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.commentId = counter.value;
  next();
});

module.exports = model("Comment", CommentSchema);
