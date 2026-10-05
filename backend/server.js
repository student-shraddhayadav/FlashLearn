const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

const Video = require("./models/Video");
const LearningHistory = require("./models/LearningHistory");
const QuizHistory = require("./models/QuizHistory");

const { fetchTranscript } = require("youtube-transcript-plus");

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error);
  });

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// GEMINI API
// ==========================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
// Extract the YouTube video ID
function extractVideoId(videoUrl) {
  try {
    const url = new URL(videoUrl);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.substring(1);
    }

    return url.searchParams.get("v");

  } catch (error) {
    return null;
  }
}

//Embedding
async function createEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  return response.embeddings[0].values;
}
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
async function generateWithRetry(prompt, maxRetries = 2) {

  const models = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite"
  ];

  for (const model of models) {

    for (let attempt = 0; attempt < maxRetries; attempt++) {

      try {

        console.log(
          `Trying ${model} - attempt ${attempt + 1}`
        );

        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
        });

        console.log(
          `Success using ${model}`
        );

        return response;

      } catch (error) {

        console.log(
          `${model} failed with status:`,
          error.status
        );

        // For errors other than temporary
        // availability/rate-limit errors,
        // don't keep retrying.
        if (
          error.status !== 503 &&
          error.status !== 429
        ) {
          throw error;
        }

        // If this was the last retry for
        // this model, move to next model.
        if (attempt === maxRetries - 1) {
          console.log(
            `${model} unavailable. Trying next model...`
          );
          break;
        }

        const delay = Math.pow(2, attempt) * 2000;

        console.log(
          `Retrying in ${delay / 1000} seconds...`
        );

        await new Promise((resolve) =>
          setTimeout(resolve, delay)
        );
      }
    }
  }

  throw new Error(
    "All Gemini models are currently unavailable. Please try again later."
  );
}

// -------------------Cosine similarity--------
function cosineSimilarity(vectorA, vectorB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
// ----------------Retrieval function----------------------------
function retrieveRelevantChunks(
  questionEmbedding,
  embeddedChunks,
  topK = 3,
  threshold = 0.4
) {
  const results = embeddedChunks.map((chunk) => {
    const similarity = cosineSimilarity(
      questionEmbedding,
      chunk.embedding
    );

    return {
      text: chunk.text,
      score: similarity,
    };
  });

  results.sort((a, b) => b.score - a.score);

  const relevantResults = results.filter(
    (chunk) => chunk.score >= threshold
  );

  return relevantResults.slice(0, topK);
}
// ==========================================
// GENERATE ANSWER USING RAG
// ==========================================

async function generateRAGAnswer(question, relevantChunks) {

  // Combine retrieved chunks into one context
  const context = relevantChunks
    .map((chunk, index) => {
      return `Chunk ${index + 1}:
${chunk.text}`;
    })
    .join("\n\n");

  const prompt = `
You are FlashLearn, an educational AI assistant.

Answer the user's question using ONLY the information
provided in the retrieved transcript chunks.

If the answer cannot be found in the provided chunks,
say:

"I could not find this information in the video."

Do not use outside knowledge.

Use simple English.
Keep the answer clear and beginner-friendly.

========================================
USER QUESTION
========================================

${question}

========================================
RETRIEVED TRANSCRIPT CHUNKS
========================================

${context}

========================================
ANSWER
========================================

Answer the question based only on the retrieved chunks.
`;

  const response = await generateWithRetry(prompt);

  return response.text;
}
// -------------------------------------------
// ANALYZE
// -------------------------------------------
app.post("/analyze", async (req, res) => {
  const { videoUrl } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({
      message: "Please enter a YouTube video URL",
    });
  }
  
  const videoId = extractVideoId(videoUrl);

if (!videoId) {
  return res.status(400).json({
    message: "Invalid YouTube URL",
  });
}

console.log("Video ID:", videoId);
  // Check if video is already analyzed
  const existingVideo = await Video.findOne({
    videoId: videoId,
  });

  if (existingVideo) {
    console.log(
      "Video already exists in MongoDB. Returning saved result."
    );

    return res.json({
      message: "Video already analyzed. Loaded previous result.",
      videoId: existingVideo.videoId,
      // transcript:existingVideo.transcript,
      summary: existingVideo.summary,
      importantPoints: existingVideo.importantPoints,
      explanation: existingVideo.explanation,
      notes: existingVideo.notes,
      topics: existingVideo.topics,
      quiz: existingVideo.quiz,
    });
  }

  console.log("====================================");
  console.log("YouTube URL received:");
  console.log(videoUrl);
  console.log("====================================");

  // Transcript+chunking
  function createChunks(text, chunkSize = 1000) {
    const words = text.split(/\s+/);
    const chunks = [];
  
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(
        words.slice(i, i + chunkSize).join(" ")
      );
    }
  
    return chunks;
  }

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

    const chunks = createChunks(transcriptText,300);

    console.log("Number of chunks:", chunks.length);
    console.log("First chunk:", chunks[0]);

    console.log("Creating embeddings...");

const embeddedChunks = [];

for (const chunk of chunks) {
  const embedding = await createEmbedding(chunk);

  embeddedChunks.push({
    text: chunk,
    embedding: embedding,
  });
}

await Video.findOneAndUpdate(
  { videoId: videoId },

  {
    videoId: videoId,
    videoUrl: videoUrl,
    transcript: transcriptText,
    chunks: embeddedChunks,
  },

  {
    upsert: true,
    returnDocument: "after"
  }
);

console.log("Video and embeddings saved to MongoDB!");

console.log(
  "Embeddings created:",
  embeddedChunks.length
);

console.log(
  "Embedding size:",
  embeddedChunks[0].embedding.length
);
// ========================================
// TEST RAG RETRIEVAL
// ========================================

const testQuestion =
  "What is Type 2 thinking in AI";

console.log("Test question:", testQuestion);

const questionEmbedding =
  await createEmbedding(testQuestion);

console.log(
  "Question embedding created!"
);

const relevantChunks =
  retrieveRelevantChunks(
    questionEmbedding,
    embeddedChunks,
    3
  );
// ========================================
// DISPLAY RETRIEVED CHUNKS
// ========================================

console.log(
  "Number of relevant chunks:",
  relevantChunks.length
);

if (relevantChunks.length === 0) {

  console.log(
    "No relevant information found in the video."
  );

} else {

  console.log(
    "Relevant chunks:"
  );

  relevantChunks.forEach((chunk, index) => {

    console.log(
      `\nChunk ${index + 1}`
    );

    console.log(
      "Similarity:",
      chunk.score
    );

    console.log(
      "Text:",
      chunk.text.substring(0, 300)
    );

  });

}
// console.log("FIRST TRANSCRIPT ITEM:");
// console.log(transcript[0]);


    // ========================================
    // STEP 3: TIMESTAMPED TRANSCRIPT
    // ========================================

    const timestampedTranscript = transcript
    .map((item) => {
    const totalSeconds = Math.floor(item.offset);

    const minutes = Math.floor(totalSeconds / 60);
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

    
    const response = await generateWithRetry(
      
    `You are FlashLearn, an educational AI assistant
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
      `
  );


    // ========================================
    // STEP 5: GET AI RESPONSE
    // ========================================

    const aiText = response.text;

    console.log(
      "AI response generated successfully!"
    );

    // ========================================
    // STEP 6: CONVERT AI RESPONSE TO JSON
    // ========================================

    let aiData;

    try {
      aiData = JSON.parse(aiText);

      // Save video data in MongoDB
const savedVideo = await Video.findOneAndUpdate(
  { videoId: videoId },
  {
    videoId: videoId,
    videoUrl: videoUrl,

    chunks: embeddedChunks,

    summary: aiData.summary || "",

    importantPoints: aiData.importantPoints || [],

    explanation: aiData.explanation || "",

    notes: aiData.notes || [],

    topics: aiData.topics || [],

    quiz: aiData.quiz || [],
  },
  {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }
);

console.log("Video and learning material saved to MongoDB!");

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
        
      videoId: videoId,
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
// ASK QUESTION USING RAG
// ==========================================

app.post("/ask", async (req, res) => {

  const { videoId, question } = req.body;
  // Check inputs
  if (!videoId || !question) {
    return res.status(400).json({
      message: "Please provide question",
    });
  }

  try {
    // ========================================
    // STEP 1: FIND VIDEO IN MONGODB
    // ========================================

    const video = await Video.findOne({ videoId: videoId });
    if (!video) {
      return res.status(404).json({
        message: "Video not found. Please analyze the video first.",
      });
    }
    console.log(
      "Video found:",
      video.videoId
    );
    console.log(
      "Stored chunks:",
      video.chunks.length
    );

    // ========================================
    // STEP 4: EMBED USER QUESTION
    // ========================================

    console.log(
      "Creating question embedding..."
    );

    const questionEmbedding =
      await createEmbedding(question);

    console.log(
      "Question embedding created!"
    );


    // ========================================
    // STEP 5: RETRIEVE RELEVANT CHUNKS
    // ========================================

    const relevantChunks =
      retrieveRelevantChunks(
        questionEmbedding,
        video.chunks,
        3,
        0.4
      );

    console.log(
      "Relevant chunks:",
      relevantChunks.length
    );


    // ========================================
    // STEP 6: GENERATE ANSWER
    // ========================================

    const answer =
      await generateRAGAnswer(
        question,
        relevantChunks
      );
       try{
      await LearningHistory.create({
        videoId: videoId,
        videoUrl: video.videoUrl,
        question: question,
        answer: answer
      });
    }
    catch (error) {
  console.error("Failed to save learning history:", error);
}
      console.log("Learning history saved to MongoDB!");
    // ========================================
    // STEP 7: SEND RESPONSE
    // ========================================

    res.json({

      question: question,

      answer: answer,

      sources: relevantChunks.map((chunk) => ({
        text: chunk.text,
        score: chunk.score,
      })),

    });

  } catch (error) {

    console.error(
      "RAG ERROR:",
      error
    );

    res.status(500).json({

      message: "Something went wrong while answering the question.",

      error: error.message,

    });

  }

});
app.post("/quiz/submit", async (req, res) => {
  const { videoId, score, totalQuestions } = req.body;

  if (
    !videoId ||
    score === undefined ||
    !totalQuestions
  ) {
    return res.status(400).json({
      message: "Please provide videoId, score and totalQuestions",
    });
  }

  try {
    // Check that the video exists
    const video = await Video.findOne({
      videoId: videoId,
    });

    if (!video) {
      return res.status(404).json({
        message: "Video not found. Please analyze the video first.",
      });
    }

    // Save quiz attempt
    const quizHistory = await QuizHistory.create({
      videoId: videoId,
      score: score,
      totalQuestions: totalQuestions,
    });

    console.log("Quiz history saved!");

    res.json({
      message: "Quiz result saved successfully",
      quizHistory: quizHistory,
    });

  } catch (error) {
    console.error("QUIZ HISTORY ERROR:", error);

    res.status(500).json({
      message: "Failed to save quiz result",
      error: error.message,
    });
  }
});
app.get("/quiz/history/:videoId", async (req, res) => {
  const { videoId } = req.params;

  try {
    const history = await QuizHistory.find({
      videoId: videoId,
    }).sort({
      attemptedAt: -1,
    });

    res.json({
      videoId: videoId,
      attempts: history,
    });

  } catch (error) {
    console.error("QUIZ HISTORY ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch quiz history",
      error: error.message,
    });
  }
});
// ==========================================
// START SERVER
// ==========================================

app.listen(5001, () => {
  console.log(
    "===================================="
  );

  console.log(
    "FlashLearn Backend"
  );

  console.log(
    "Server running on port 5001"
  );

  console.log(
    "===================================="
  );
});