const mongoose = require("mongoose");

const learningHistorySchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      required: true,
    },

    videoUrl: {
      type: String,
      required: true,
    },

    question: {
      type: String,
      required: true,
    },

    answer: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "LearningHistory",
    learningHistorySchema
  );