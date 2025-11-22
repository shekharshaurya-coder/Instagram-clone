// models/message.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./counter");

const MessageSchema = new Schema({
  messageId: { type: Number, unique: true }, // AUTO INCREMENT

  conversationId: { type: String, required: true },

  sender: { type: Types.ObjectId, ref: "User", required: true },
  recipients: [{ type: Types.ObjectId, ref: "User" }],

  text: { type: String, default: "" },
  attachments: [{ url: String, type: String }],

  deliveredTo: [{ type: Types.ObjectId }],
  readBy: [{ type: Types.ObjectId }],
}, { timestamps: true });

MessageSchema.pre("save", async function(next) {
  if (this.messageId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "messageId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.messageId = counter.value;
  next();
});

module.exports = model("Message", MessageSchema);
