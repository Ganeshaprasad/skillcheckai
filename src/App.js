import React, { useState } from 'react';
import Home from './components/Home';
import Interview from './components/Interview';
import { fetchQuestions, getFeedback } from './utils/api';

function App() {
  const [page, setPage] = useState('home');
  const [interviewData, setInterviewData] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [answersData, setAnswersData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleStart = async (data) => {
    setLoading(true);
    console.log('🚀 Starting with:', data);
    
    try {
      const numQuestions = data.duration === 10 ? 4 : 6;
      console.log(`📝 Fetching ${numQuestions} questions...`);
      const questions = await fetchQuestions(data.topic, numQuestions);
      console.log('✅ Questions:', questions);
      
      setInterviewData({ ...data, questions });
      setTimeout(() => {
        setPage('interview');
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Failed to fetch questions');
      setLoading(false);
    }
  };

  const handleFinish = async (answers, lastAnswer) => {
    setLoading(true);
    console.log('📊 Generating feedback...');
    console.log('📊 Received answers count:', answers.length);
    console.log('📊 Answers received:', answers);
    console.log('📊 Total questions in interview:', interviewData.questions.length);
    
    // Use all collected answers - they include main + follow-up/rephrase answers
    let allAnswers = answers && answers.length > 0 ? answers : [];
    
    // Only add lastAnswer if it's new and not already tracked
    if (lastAnswer && lastAnswer.trim() && allAnswers.length > 0) {
      const lastStoredAns = allAnswers[allAnswers.length - 1]?.ans || '';
      if (lastAnswer.trim() !== lastStoredAns.trim()) {
        console.log('⚠️ Adding final answer that wasn\'t tracked');
        allAnswers = [...allAnswers, { q: allAnswers.length, ans: lastAnswer }];
      }
    }
    
    console.log(`✅ Total answers for feedback: ${allAnswers.length}`);
    console.log('✅ All answers:', allAnswers);
    
    setAnswersData(allAnswers);
    const fb = await getFeedback(interviewData.questions, allAnswers, interviewData.topic);
    setFeedback(fb);
    setPage('feedback');
    setLoading(false);
  };

  const handleRestart = () => {
    console.log('🔄 Restarting...');
    setPage('home');
    setFeedback(null);
    setInterviewData(null);
    setAnswersData(null);
  };

  const parseFeedback = (feedbackText) => {
    const lines = feedbackText.split('\n').map(l => l.trim()).filter(l => l);
    const items = [];
    let currentItem = null;
    let feedbackLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match Q# format (Q1:, Q2:, etc.)
      const qMatch = line.match(/^Q(\d+):\s*(.+)/i);
      if (qMatch) {
        // Save previous item if exists
        if (currentItem) {
          currentItem.feedback = feedbackLines.join(' ').trim();
          items.push(currentItem);
          feedbackLines = [];
        }
        
        const qNum = parseInt(qMatch[1]) - 1;
        currentItem = {
          questionNum: qNum,
          question: qMatch[2],
          score: null,
          feedback: ''
        };
        continue;
      }

      // Match Score: format
      const scoreMatch = line.match(/^Score:\s*(\d+)\s*\/\s*10/i);
      if (scoreMatch && currentItem) {
        currentItem.score = scoreMatch[1];
        continue;
      }

      // Match Feedback: format
      const feedbackMatch = line.match(/^(?:Feedback|💡):\s*(.+)/i);
      if (feedbackMatch && currentItem) {
        feedbackLines.push(feedbackMatch[1]);
        continue;
      }

      // Any other line that belongs to feedback
      if (currentItem && line && !line.includes('AVERAGE SCORE') && !line.includes('---')) {
        feedbackLines.push(line);
      }
    }

    // Don't forget the last item
    if (currentItem) {
      currentItem.feedback = feedbackLines.join(' ').trim();
      items.push(currentItem);
    }

    // If nothing was parsed, try to create items from answers data
    if (items.length === 0 && answersData && answersData.length > 0) {
      return answersData.map((ans, idx) => ({
        questionNum: idx,
        question: ans.question || `Question ${idx + 1}`,
        score: '0',
        feedback: '(No feedback generated)'
      }));
    }

    return items;
  };

  const getStarRating = (score) => {
    const num = parseInt(score);
    if (num >= 9) return '⭐⭐⭐⭐⭐';
    if (num >= 7) return '⭐⭐⭐⭐';
    if (num >= 5) return '⭐⭐⭐';
    if (num >= 3) return '⭐⭐';
    if (num >= 1) return '⭐';
    return '☆';
  };

  return (
    <div className="App" style={{ minHeight: '100vh', background: '#1a1a1a' }}>
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 999
        }}>
          <div style={{ background: '#2d2d2d', padding: '30px', borderRadius: '15px', color: 'white', textAlign: 'center' }}>
            <h2>⏳ {page === 'interview' || page === 'home' ? 'Loading...' : 'Preparing Feedback...'}</h2>
            <p>{page === 'interview' || page === 'home' ? 'Preparing your interview' : 'Analyzing your answers'}</p>
          </div>
        </div>
      )}

      {page === 'home' && <Home onStart={handleStart} />}
      
      {page === 'interview' && interviewData && (
        <Interview
          {...interviewData}
          onFinish={handleFinish}
          onQuit={handleRestart}
        />
      )}
      
      {page === 'feedback' && feedback && (
        <div style={{
          padding: '50px 20px',
          maxWidth: '1200px',
          margin: 'auto',
          color: 'white',
          fontFamily: 'Segoe UI, Arial'
        }}>
          <h1 style={{
            color: '#0078d4',
            textAlign: 'center',
            fontSize: '36px',
            marginBottom: '40px'
          }}>
            🎉 Interview Complete!
          </h1>

          {parseFeedback(feedback).map((item, idx) => {
            const answerData = answersData && answersData[idx];
            const questionText = item.question || (answerData && answerData.question) || `Question ${idx + 1}`;
            const answerText = answerData && answerData.ans ? answerData.ans : '(No answer)';
            const score = item.score || '0';
            const feedbackText = item.feedback || '(No feedback available)';
            
            return (
              <div key={idx} style={{
                background: '#2d2d2d',
                border: '2px solid #0078d4',
                borderRadius: '15px',
                padding: '25px',
                marginBottom: '25px',
                boxShadow: '0 4px 15px rgba(0, 120, 212, 0.2)'
              }}>
                <div style={{
                  fontSize: '16px',
                  color: '#00BCD4',
                  fontWeight: 'bold',
                  marginBottom: '15px'
                }}>
                  ❓ Q{idx + 1}: {questionText}
                </div>

                <div style={{
                  fontSize: '15px',
                  color: '#81C784',
                  marginBottom: '15px',
                  padding: '15px',
                  background: 'rgba(129, 199, 132, 0.1)',
                  borderRadius: '8px',
                  fontStyle: 'italic',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  💬 <strong>Your Answer:</strong> {answerText}
                </div>

                <div style={{
                  fontSize: '18px',
                  color: '#FFD700',
                  fontWeight: 'bold',
                  marginBottom: '15px'
                }}>
                  {getStarRating(score)} Score: {score}/10
                </div>

                <div style={{
                  fontSize: '14px',
                  color: '#E0E0E0',
                  lineHeight: '1.6',
                  padding: '15px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  borderLeft: '3px solid #FFC107'
                }}>
                  <strong>💡 Feedback:</strong> {feedbackText}
                </div>
              </div>
            );
          })}

          {feedback.includes('AVERAGE SCORE') && (
            <div style={{
              background: 'linear-gradient(135deg, #0078d4 0%, #00a8e8 100%)',
              padding: '25px',
              borderRadius: '15px',
              textAlign: 'center',
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '30px',
              boxShadow: '0 4px 20px rgba(0, 120, 212, 0.4)',
              color: 'white'
            }}>
              📊 {feedback.split('\n').find(l => l.includes('AVERAGE SCORE'))}
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleRestart}
              style={{
                padding: '15px 40px',
                fontSize: '20px',
                background: '#107c10',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 4px 15px rgba(16, 124, 16, 0.4)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              🔄 Take Another Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;