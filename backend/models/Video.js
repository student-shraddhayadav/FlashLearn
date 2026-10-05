const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },

  embedding: {
    type: [Number],
    required: true,
  },
});

const quizQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },

  options: {
    type: [String],
    required: true,
  },

  answer: {
    type: String,
    required: true,
  },
});

const videoSchema = new mongoose.Schema({
  // YouTube video ID
  videoId: {
    type: String,
    required: true,
    unique: true,
  },

  // Original YouTube URL
  videoUrl: {
    type: String,
    required: true,
  },

  // RAG chunks + embeddings
  chunks: {
    type: [chunkSchema],
    required: true,
  },

  // Generated learning material
  summary: {
    type: String,
    default: "",
  },

  importantPoints: {
    type: [String],
    default: [],
  },

  explanation: {
    type: String,
    default: "",
  },

  notes: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },

  topics: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },

  // Generated quiz
  quiz: {
    type: [quizQuestionSchema],
    default: [],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Video", videoSchema);