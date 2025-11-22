// models/notification.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./counter");

const NotificationSchema = new Schema({
  notificationId: { type: Number, unique: true }, // AUTO INCREMENT

  user: { type: Types.ObjectId, ref: "User", required: true },
  actor: { type: Types.ObjectId, ref: "User" },

  verb: {
    type: String,
    enum: ["like", "comment", "follow", "mention", "reply", "system"],
    required: true
  },

  targetType: String,
  targetId: Types.ObjectId,
  read: { type: Boolean, default: false },

}, { timestamps: true });

NotificationSchema.pre("save", async function(next) {
  if (this.notificationId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "notificationId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.notificationId = counter.value;
  next();
});

module.exports = model("Notification", NotificationSchema);
