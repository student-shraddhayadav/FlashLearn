const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const { fetchTranscript } = require("youtube-transcript-plus");

dotenv.config();

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// OPENAI
// ==========================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==========================================
// HOME ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "FlashLearn Backend is Running!",
  });
});

// ==========================================
// ANALYZE YOUTUBE VIDEO
// ==========================================

app.post("/analyze", async (req, res) => {
  const { videoUrl } = req.body;

  // Check YouTube URL
  if (!videoUrl) {
    return res.status(400).json({
      message: "Please enter a YouTube video URL",
    });
  }

  console.log("====================================");
  console.log("YouTube URL received:");
  console.log(videoUrl);
  console.log("====================================");

  try {
    // ========================================
    // STEP 1: FETCH TRANSCRIPT
    // ========================================

    console.log("Fetching YouTube transcript...");

    const transcript = await fetchTranscript(videoUrl);

    console.log("Transcript fetched successfully!");

    // ========================================
    // STEP 2: NORMAL TRANSCRIPT
    // ========================================

    const transcriptText = transcript
      .map((item) => item.text)
      .join(" ");

    console.log(
      "Transcript length:",
      transcriptText.length
    );

    // ========================================
    // STEP 3: TIMESTAMPED TRANSCRIPT
    // ========================================

    const timestampedTranscript = transcript
      .map((item) => {
        const totalSeconds = Math.floor(
          item.offset / 1000
        );

        const minutes = Math.floor(
          totalSeconds / 60
        );

        const seconds = totalSeconds % 60;

        const timestamp =
          String(minutes).padStart(2, "0") +
          ":" +
          String(seconds).padStart(2, "0");

        return `[${timestamp}] ${item.text}`;
      })
      .join("\n");

    console.log(
      "Timestamped transcript created!"
    );

    // ========================================
    // STEP 4: SEND TRANSCRIPT TO AI
    // ========================================

    console.log(
      "Generating AI learning material..."
    );

    const response =
      await openai.responses.create({
        model: "gpt-5.6-luna",

        input: `
You are FlashLearn, an educational AI assistant
for college students.

Read the YouTube video transcript carefully.

Create learning material for a beginner student.

Use SIMPLE ENGLISH.

Do not use difficult words.

IMPORTANT:
Return ONLY valid JSON.
Do not return markdown.
Do not use code blocks.
Do not write any explanation outside the JSON.

The JSON must have exactly these fields:

{
  "summary": "",
  "importantPoints": [],
  "explanation": "",
  "notes": [],
  "topics": [],
  "quiz": []
}

========================================
SUMMARY
========================================

Create a simple summary in 5 to 8 sentences.

========================================
IMPORTANT POINTS
========================================

Create exactly 5 important points.

Each point should be a simple sentence.

========================================
EXPLANATION
========================================

Explain the main concept of the video
in very simple English.

Assume the student is learning this topic
for the first time.

========================================
STUDY NOTES
========================================

Create 3 to 5 study note sections.

Each section should follow this structure:

{
  "heading": "Topic heading",
  "points": [
    "Point 1",
    "Point 2",
    "Point 3"
  ]
}

========================================
IMPORTANT TOPICS
========================================

Find 5 to 8 important topics from the video.

Each topic must follow this structure:

{
  "timestamp": "MM:SS",
  "title": "Topic name",
  "description": "Short simple explanation"
}

IMPORTANT:

Use timestamps ONLY from the transcript.

Do not invent timestamps.

Use the closest timestamp available
in the transcript.

========================================
AI QUIZ
========================================

Create exactly 5 multiple-choice questions.

Each question must have exactly 4 options.

Each question must follow this structure:

{
  "question": "Question here?",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "answer": "A"
}

The answer must be only:

A
B
C
or
D

Rules:

- Exactly 5 questions
- Exactly 4 options per question
- Only one correct answer
- Questions must be based only on the video
- Keep questions beginner-friendly
- Mix easy and medium questions

========================================
TIMESTAMPED VIDEO TRANSCRIPT
========================================

${timestampedTranscript}
        `,
      });

    // ========================================
    // STEP 5: GET AI RESPONSE
    // ========================================

    const aiText = response.output_text;

    console.log(
      "AI response generated successfully!"
    );

    // ========================================
    // STEP 6: CONVERT AI RESPONSE TO JSON
    // ========================================

    let aiData;

    try {
      aiData = JSON.parse(aiText);
    } catch (error) {
      console.log(
        "AI returned invalid JSON."
      );

      console.log(
        "Raw AI response:"
      );

      console.log(aiText);

      return res.status(500).json({
        message:
          "AI returned an invalid response.",
        error:
          "Could not convert AI response to JSON.",
      });
    }

    // ========================================
    // STEP 7: SEND DATA TO FRONTEND
    // ========================================

    console.log(
      "Sending data to frontend..."
    );

    res.json({
      message:
        "Video analyzed successfully!",

      transcript:
        transcriptText,

      summary:
        aiData.summary || "",

      importantPoints:
        aiData.importantPoints || [],

      explanation:
        aiData.explanation || "",

      notes:
        aiData.notes || [],

      topics:
        aiData.topics || [],

      quiz:
        aiData.quiz || [],
    });

    console.log(
      "Data sent successfully!"
    );

  } catch (error) {
    // ========================================
    // ERROR HANDLING
    // ========================================

    console.error(
      "===================================="
    );

    console.error(
      "ERROR:"
    );

    console.error(error);

    console.error(
      "===================================="
    );

    res.status(500).json({
      message:
        "Something went wrong.",

      error:
        error.message,
    });
  }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(5000, () => {
  console.log(
    "===================================="
  );

  console.log(
    "FlashLearn Backend"
  );

  console.log(
    "Server running on port 5000"
  );

  console.log(
    "===================================="
  );
});