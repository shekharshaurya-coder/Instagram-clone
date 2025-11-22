// models/media.js
const { Schema, model, Types } = require("mongoose");
const Counter = require("./counter");

const MediaSchema = new Schema({
  mediaId: { type: Number, unique: true }, // AUTO INCREMENT

  ownerType: { type: String, enum: ["User", "Post", "Message"], required: true },
  ownerId: { type: Types.ObjectId, required: true },

  url: { type: String, required: true },
  storageKey: { type: String, required: true },

  mimeType: String,
  width: Number,
  height: Number,
  duration: Number,
  sizeBytes: Number,

  processed: { type: Boolean, default: false },
}, { timestamps: true });

MediaSchema.pre("save", async function(next) {
  if (this.mediaId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: "mediaId" },
    { $inc: { value: 1 }},
    { upsert: true, new: true }
  );

  this.mediaId = counter.value;
  next();
});

module.exports = model("Media", MediaSchema);
