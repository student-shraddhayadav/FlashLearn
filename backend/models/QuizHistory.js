const mongoose = require("mongoose");

const quizHistorySchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
  },

  score: {
    type: Number,
    required: true,
  },

  totalQuestions: {
    type: Number,
    required: true,
  },

  attemptedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "QuizHistory",
  quizHistorySchema
);