import { useState } from "react";
import "./App.css";

function App() 
{
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [result, setResult] = useState("");


  const [summary, setSummary] = useState("");
  const [importantPoints, setImportantPoints] = useState([]);
  const [explanation, setExplanation] = useState("");
  const [notes, setNotes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [quiz, setQuiz] = useState([]);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [score, setScore] = useState(null);

  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  // ==========================================
  // ANALYZE VIDEO
  // ==========================================

  const analyzeVideo = async () => {
    if (videoUrl.trim() === "") {
      alert("Please enter a YouTube video URL");
      return;
    }

    try {
      setResult("Analyzing video...");

      // Clear old results
      // setTranscript("");
      setSummary("");
      setImportantPoints([]);
      setExplanation("");
      setNotes([]);
      setTopics([]);
      setQuiz([]);
      setSelectedAnswers({});
      setScore(null);

      // Send URL to backend
      const response = await fetch(
        "http://localhost:5001/analyze",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            videoUrl: videoUrl,
          }),
        }
      );

      const data = await response.json();

      // Check backend error
      if (!response.ok) {
        setResult(
          data.message || "Something went wrong"
        );
        return;
      }

      // ========================================
      // SET RESPONSE DATA
      // ========================================

      setResult(
        data.message || "Video analyzed successfully!"
      );
      setVideoId(data.videoId || "");

      setSummary(data.summary || "");

      setImportantPoints(
        data.importantPoints || []
      );

      setExplanation(
        data.explanation || ""
      );

      setNotes(data.notes || []);

      setTopics(data.topics || []);

      setQuiz(data.quiz || []);

    } catch (error) {
      console.error("Error:", error);

      setResult(
        "Backend connection failed. Please check the server."
      );

      setTranscript("");
      setSummary("");
      setImportantPoints([]);
      setExplanation("");
      setNotes([]);
      setTopics([]);
      setQuiz([]);
      setSelectedAnswers({});
      setScore(null); 
      setVideoId("");
      setQuestion("");
      setQaHistory([]);
    }
  };
  // Adding QnA
  const askQuestion = async () => {

    if (question.trim() === "") {
      alert("Please enter a question");
      return;
    }
  
    if (!videoId) {
      alert("Please analyze a video first");
      return;
    }
  
    try {
  
      setAsking(true);
  
      const currentQuestion = question;
  
      const response = await fetch(
        "http://localhost:5001/ask",
        {
          method: "POST",
  
          headers: {
            "Content-Type": "application/json",
          },
  
          body: JSON.stringify({
            videoId: videoId,
            question: currentQuestion,
          }),
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        alert(
          data.message || "Something went wrong"
        );
        return;
      }
  
      // Add new question and answer   
      // Keep all previous questions and add the new one at the end.
      setQaHistory((previousHistory) => [
        ...previousHistory,
        {
          question: currentQuestion,
          answer: data.answer || "",
        },
      ]);
  
      // Clear input
      setQuestion("");
  
    } catch (error) {
  
      console.error(
        "Error asking question:",
        error
      );
  
    } finally {
  
      setAsking(false);
  
    }
  };
  // ==========================================
  // SELECT QUIZ ANSWER
  // ==========================================

  const selectAnswer = (
    questionIndex,
    answer
  ) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answer,
    });
  };

  // ==========================================
  // SUBMIT QUIZ
  // ==========================================

  const submitQuiz = async () => {
    let correctAnswers = 0;
  
    quiz.forEach((question, index) => {
      const userAnswer = selectedAnswers[index];
  
      if (userAnswer === question.answer) {
        correctAnswers++;
      }
    });
  
    setScore(correctAnswers);
  
    try {
      const response = await fetch(
        "http://localhost:5001/quiz/submit",
        {
          method: "POST",
  
          headers: {
            "Content-Type": "application/json",
          },
  
          body: JSON.stringify({
            videoId: videoId,
            score: correctAnswers,
            totalQuestions: quiz.length,
          }),
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        console.error(
          "Failed to save quiz history:",
          data.message
        );
        return;
      }
  
      console.log(
        "Quiz history saved:",
        data
      );
  
    } catch (error) {
      console.error(
        "Quiz history error:",
        error
      );
    }
  };

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="app">

      {/* ======================================
          NAVBAR
      ====================================== */}

      <nav className="navbar">

        <div className="logo">
          📚 FlashLearn
        </div>

        <div className="nav-links">

          <a href="#home">
            Home
          </a>

          <a href="#features">
            Features
          </a>

          <a href="#about">
            About
          </a>

        </div>

      </nav>


      {/* ======================================
          HERO SECTION
      ====================================== */}

      <section
        className="hero-section"
        id="home">

        <div className="hero-content">

          <h1>
            Learn Smarter with{" "}
            <span>FlashLearn</span>
          </h1>

          <p>
            Turn YouTube educational videos
            into summaries, notes, quizzes
            and important topics using AI.
          </p>

       </div>
       </section>
          {/* ==================================
              YOUTUBE INPUT
          ================================== */}

          <div className="input-box">

            <input
              type="text"
              placeholder="Paste YouTube video link here..."
              value={videoUrl}
              onChange={(e) =>
                setVideoUrl(e.target.value)
              }
            />

            <button
              onClick={analyzeVideo}
            >
              Analyze Video
            </button>

          </div>


          {/* ==================================
              RESULT MESSAGE
          ================================== */}

          {result && (
            <div className="result-box">

              <h3>
                Analysis Result
              </h3>

              <p>
                {result}
              </p>

            </div>
          )}


          {/* ==================================
              AI SUMMARY
          ================================== */}

          {summary && (
            <div className="summary-box">

              <h3>
                🤖 AI Summary
              </h3>

              <div className="summary-content">
                {summary}
              </div>

            </div>
          )}


          {/* ==================================
              IMPORTANT POINTS
          ================================== */}

          {importantPoints.length > 0 && (
            <div className="summary-box">

              <h3>
                📌 Important Points
              </h3>

              <div className="summary-content">

                <ul>

                  {importantPoints.map(
                    (point, index) => (
                      <li key={index}>
                        {point}
                      </li>
                    )
                  )}

                </ul>

              </div>

            </div>
          )}


          {/* ==================================
              EXPLANATION
          ================================== */}

          {explanation && (
            <div className="summary-box">

              <h3>
                💡 Simple Explanation
              </h3>

              <div className="summary-content">
                {explanation}
              </div>

            </div>
          )}


          {/* ==================================
              STUDY NOTES
          ================================== */}

          {notes.length > 0 && (
            <div className="notes-box">

              <h3>
                📚 Study Notes
              </h3>

              <div className="notes-content">

                {notes.map(
                  (note, index) => (

                    <div
                      className="note-section"
                      key={index}
                    >

                      <h4>
                        {index + 1}.{" "}
                        {note.heading}
                      </h4>

                      <ul>

                        {note.points.map(
                          (point, pointIndex) => (
                            <li
                              key={pointIndex}
                            >
                              {point}
                            </li>
                          )
                        )}

                      </ul>

                    </div>

                  )
                )}

              </div>

            </div>
          )}


          {/* ==================================
              IMPORTANT TOPICS
          ================================== */}

          {topics.length > 0 && (
            <div className="topics-box">

              <h3>
                ⏱️ Important Topics
              </h3>

              <div className="topics-content">

                {topics.map(
                  (topic, index) => (

                    <div
                      className="topic-card"
                      key={index}
                    >

                      <div className="topic-time">
                        ⏱️ {topic.timestamp}
                      </div>

                      <div className="topic-info">

                        <h4>
                          {topic.title}
                        </h4>

                        <p>
                          {topic.description}
                        </p>

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>
          )}
          
          {/* ==================================
                AI Q&A
              ================================== */}

    {videoId && (
        <div className="qa-box">

         <h2> 🤖 Ask FlashLearn AI </h2>

         <p className="qa-description">
            Ask questions about this video and
            get answers based on its content.
          </p>

     <div className="qa-input-box">

      <input
        type="text"
        placeholder="Ask something about this video..."
        value={question}
        onChange={(e) =>
          setQuestion(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            askQuestion();
          }
        }}
      />

      <button
        onClick={askQuestion}
        disabled={asking}>
        {asking ? "Thinking..." : "Ask AI"}
      </button>

    </div>


    {qaHistory.length > 0 && (
     <div className="qa-history">

    {qaHistory.map((item, index) => (

      <div className="qa-conversation" key={index} >

        {/* Question */}

        <div className="question-box">

          <h4>🧑 You  </h4>

          <p> {item.question}  </p>

        </div>


        {/* Answer */}

        <div className="answer-box">

          <h4>   🤖 FlashLearn AI </h4>

          <p> {item.answer} </p>

        </div>

      </div>

        ))}

      </div>
      )}

       </div>
     )}

          {/* ==================================
              AI QUIZ
          ================================== */}

          {quiz.length > 0 && (
            <div className="quiz-box">

              <h2>
                🧠 AI Quiz
              </h2>

              <p className="quiz-description">
                Test your understanding of
                the video.
              </p>


              {quiz.map(
                (question, index) => (

                  <div
                    className="question-card"
                    key={index}
                  >

                    <h3>
                      Q{index + 1}.{" "}
                      {question.question}
                    </h3>


                    <div className="options">

                      {question.options.map(
                        (
                          option,
                          optionIndex
                        ) => {

                          const optionLetter =
                            String.fromCharCode(
                              65 + optionIndex
                            );

                          return (

                            <label
                              className="option"
                              key={optionIndex}
                            >

                              <input
                                type="radio"
                                name={`question-${index}`}
                                value={
                                  optionLetter
                                }
                                checked={
                                  selectedAnswers[
                                    index
                                  ] ===
                                  optionLetter
                                }
                                onChange={() =>
                                  selectAnswer(
                                    index,
                                    optionLetter
                                  )
                                }
                              />

                              <span>
                                {optionLetter}.{" "}
                                {option}
                              </span>

                            </label>

                          );
                        }
                      )}

                    </div>

                  </div>
                )
              )}


              {/* ==================================
                  SUBMIT QUIZ
              ================================== */}

              <button
                className="submit-quiz"
                onClick={submitQuiz}>
                Submit Quiz
              </button>


              {/* ==================================
                  SCORE
              ================================== */}

              {score !== null && (
                <div className="score-box">

                  <h2>
                    🎉 Your Score
                  </h2>

                  <p>
                    You scored{" "}
                    <strong>
                      {score}
                    </strong>{" "}
                    out of{" "}
                    <strong>
                      {quiz.length}
                    </strong>
                  </p>


                  {score === quiz.length && (
                    <p>
                      Excellent! 🌟
                    </p>
                  )}


                  {score < quiz.length &&
                    score >=
                      Math.ceil(
                        quiz.length / 2
                      ) && (
                      <p>
                        Good job! Keep learning. 👍
                      </p>
                    )}


                  {score <
                    Math.ceil(
                      quiz.length / 2
                    ) && (
                    <p>
                      Keep practicing! 💪
                    </p>
                  )}

                </div>
              )}

            </div>
          )};



      {/* ======================================
          FEATURES
      ====================================== */}

      <section
        className="features-section"
        id="features"
      >

        <h2>
          What FlashLearn Can Do
        </h2>

        <div className="features">

          <div className="feature-card">

            <div className="feature-icon">
              📝
            </div>

            <h3>
              Smart Summary
            </h3>

            <p>
              Get a simple summary of long
              educational videos.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon">
              📚
            </div>

            <h3>
              Automatic Notes
            </h3>

            <p>
              Convert video content into
              easy study notes.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon">
              ❓
            </div>

            <h3>
              AI Quiz
            </h3>

            <p>
              Generate questions to test
              your understanding.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-icon">
              ⏱️
            </div>

            <h3>
              Important Topics
            </h3>

            <p>
              Find important topics and
              timestamps from the video.
            </p>

          </div>

        </div>

      </section>


      {/* ======================================
          ABOUT
      ====================================== */}

      <section
        className="about-section"
        id="about"
      >

        <h2>
          Why FlashLearn?
        </h2>

        <p>
          FlashLearn helps students save time
          and learn effectively by converting
          lengthy educational videos into
          organized learning material.
        </p>

      </section>


      {/* ======================================
          FOOTER
      ====================================== */}

      <footer>

        <p>
          © 2026 FlashLearn |
          Smart Learning Assistant
        </p>

      </footer>

    </div>
  );
}

export default App;