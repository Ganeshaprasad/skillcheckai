import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { speakQuestion, stopSpeaking, speakCasualFeedback } from '../utils/ttsAssembly';
import { getFollowUpQuestion } from '../utils/api';

const Interview = ({ topic, duration, questions, onFinish, onQuit }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => console.error('Play error:', err));
        }
      })
      .catch(err => console.error('Camera error:', err));

    const timerId = setInterval(() => {
      setTimeLeft(t => (t > 0 ? t - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(timerId);
      stopCamera();
    };
  }, []);

  useEffect(() => {
    const askQuestion = async () => {
      console.log(`\n🎯 Q${currentQ + 1}: ${questions[currentQ]}`);
      setLiveTranscript('');
      setFinalAnswer('');
      setLoading(false);
      setIsAISpeaking(true);
      setIsListening(false); // DON'T LISTEN WHILE AI SPEAKS

      // Stop any existing recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
          recognitionRef.current = null;
        } catch (e) {
          console.log('Stopped previous recognition');
        }
      }

      await speakQuestion(questions[currentQ]);
      setIsAISpeaking(false);
      
      console.log('⏳ Waiting 2 seconds before listening...');
      await new Promise(r => setTimeout(r, 2000));
      
      console.log('▶️ NOW starting to listen...');
      startListeningHandler();
    };

    if (questions[currentQ]) {
      askQuestion();
    }
  }, [currentQ, questions]);

  const stopCamera = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        console.log('Recognition stopped');
      }
      recognitionRef.current = null;
    }
    stopSpeaking();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const startListeningHandler = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let fullTranscript = '';

    recognition.onstart = () => {
      console.log('🎤 Listening started');
    };

    recognition.onresult = (event) => {
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          fullTranscript += (fullTranscript ? ' ' : '') + transcript;
          console.log('✓ Final:', transcript);
        } else {
          interimText = transcript;
        }
      }

      const display = fullTranscript + (interimText ? ' ' + interimText : '');
      setLiveTranscript(display);
    };

    recognition.onerror = (event) => {
      console.error('❌ Error:', event.error);
    };

    recognition.onend = () => {
      console.log('🏁 Stopped listening');
      setIsListening(false);

      if (fullTranscript.trim()) {
        setFinalAnswer(fullTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleSubmitAnswer = async () => {
    const answer = finalAnswer || liveTranscript;

    console.log('📤 Submitting:', answer);

    if (answer.trim().length < 3) {
      alert('Please provide a longer answer');
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setLoading(true);

    const newAnswers = [...answers, { q: currentQ, ans: answer }];
    setAnswers(newAnswers);

    try {
      console.log('🔍 Getting follow-up...');
      const followUpQ = await getFollowUpQuestion(topic, questions[currentQ], answer);
      setLoading(false);

      if (followUpQ) {
        setIsAISpeaking(true);
        await speakCasualFeedback('Good. One more question on that.');
        await new Promise(r => setTimeout(r, 1000));
        await speakQuestion(followUpQ);
        setIsAISpeaking(false);

        setLiveTranscript('');
        setFinalAnswer('');
        await new Promise(r => setTimeout(r, 2000));
        startListeningHandler();
      } else {
        if (currentQ < questions.length - 1) {
          setIsAISpeaking(true);
          await speakCasualFeedback('Great. Next question.');
          setIsAISpeaking(false);
          await new Promise(r => setTimeout(r, 2000));
          setCurrentQ(c => c + 1);
        } else {
          setIsAISpeaking(true);
          await speakCasualFeedback('Thank you. Let me review your answers.');
          setIsAISpeaking(false);
          await new Promise(r => setTimeout(r, 1000));
          stopCamera();
          onFinish(newAnswers, answer);
        }
      }
    } catch (error) {
      console.error('❌ Error:', error);
      setLoading(false);
    }
  };

  const handleQuit = () => {
    stopCamera();
    onQuit();
  };

  return (
    <div className="interview-wrapper" style={{
      height: '100vh', background: '#1a1a1a', color: 'white',
      display: 'flex', padding: '20px', gap: '20px', flexDirection: 'row'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        @keyframes ellipsis {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }
        
        @media (max-width: 1023px) {
          .interview-wrapper {
            flex-direction: column !important;
            height: auto !important;
            min-height: 100vh !important;
          }
          .camera-section {
            flex: 0 !important;
            width: 100% !important;
            justify-content: flex-start !important;
            order: 1 !important;
          }
          .transcript-section {
            flex: 1 !important;
            width: 100% !important;
            min-height: 250px !important;
            padding: 20px !important;
            order: 2 !important;
          }
          .button-group {
            flex-direction: row !important;
            width: 100% !important;
            order: 3 !important;
            margin-top: 15px !important;
            gap: 10px !important;
            justify-content: flex-end !important;
            padding: 0 20px !important;
          }
          .button-group button {
            flex: 1 !important;
            padding: 12px !important;
            font-size: 14px !important;
          }
          .video-stream {
            width: 100% !important;
            height: auto !important;
            max-width: 100% !important;
            aspect-ratio: 1 !important;
            margin-bottom: 20px !important;
          }
        }
        
        @media (max-width: 480px) {
          .video-stream {
            max-height: 60vw !important;
          }
          .button-group button {
            font-size: 12px !important;
            padding: 10px !important;
          }
        }
      `}</style>

      {/* LEFT: Camera */}
      <div className="camera-section" style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', position: 'relative', order: 1
      }}>
        <div style={{
          position: 'absolute', top: 20, left: 20,
          fontSize: '24px', fontWeight: 'bold', background: 'rgba(0,0,0,0.7)',
          padding: '10px 20px', borderRadius: '10px'
        }}>
          ⏱️ {formatTime(timeLeft)}
        </div>

        {/* CAMERA - 400px */}
        <video
          ref={videoRef}
          autoPlay muted
          className="video-stream"
          style={{
            width: '400px', height: '400px', objectFit: 'cover',
            borderRadius: '20px',
            border: isListening ? '3px solid #4CAF50' : '3px solid #0078d4',
            boxShadow: isListening ? '0 0 30px rgba(76, 175, 80, 0.6)' : '0 0 20px rgba(0, 120, 212, 0.5)',
            transform: 'scaleX(-1)',
            transition: 'all 0.3s ease',
            opacity: isAISpeaking ? 0.8 : 1
          }}
        />

        <div className="button-group" style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
          <button
            onClick={handleSubmitAnswer}
            disabled={isAISpeaking || loading || (!finalAnswer && !liveTranscript)}
            style={{
              padding: '15px 30px', fontSize: '16px',
              background: (finalAnswer || liveTranscript) && !isAISpeaking && !loading ? '#0078d4' : '#666',
              color: 'white', border: 'none', borderRadius: '25px',
              cursor: (finalAnswer || liveTranscript) && !isAISpeaking && !loading ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              transition: 'background 0.3s ease'
            }}
          >
            Submit
          </button>

          <button
            onClick={handleQuit}
            style={{
              padding: '15px 30px', fontSize: '16px',
              background: '#a4262e', color: 'white', border: 'none',
              borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold',
              transition: 'background 0.3s ease'
            }}
          >
            Quit
          </button>
        </div>
      </div>

      {/* RIGHT: Transcript with Status */}
      <div className="transcript-section" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.05)', borderRadius: '20px',
        padding: '30px', border: '2px solid #0078d4', gap: '20px', order: 2
      }}>
        <div style={{
          padding: '20px', background: 'rgba(0,120,212,0.2)',
          borderRadius: '15px', borderLeft: '4px solid #0078d4'
        }}>
          <strong style={{ color: '#0078d4', fontSize: '18px' }}>
            Q{currentQ + 1}/{questions.length}
          </strong>
          <p style={{ fontSize: '16px', marginTop: '15px', color: '#fff' }}>
            {questions[currentQ]}
          </p>
        </div>

        <div style={{
          padding: '20px', background: 'rgba(255,255,255,0.1)',
          borderRadius: '15px', flex: 1, overflowY: 'auto',
          minHeight: '200px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <strong style={{ fontSize: '14px', color: '#aaa' }}>YOUR RESPONSE:</strong>
            {isAISpeaking && (
              <span style={{ fontSize: '14px', color: '#FFB74D', fontStyle: 'italic' }}>
                🎙️ AI is asking the question<span style={{
                  animation: 'ellipsis 1.5s infinite',
                  display: 'inline-block',
                  width: '20px',
                  textAlign: 'left'
                }}>...</span>
              </span>
            )}
            {isListening && !isAISpeaking && (
              <span style={{ fontSize: '14px', color: '#4CAF50', fontStyle: 'italic' }}>
                🎤 Listening<span style={{
                  animation: 'ellipsis 1.5s infinite',
                  display: 'inline-block',
                  width: '20px',
                  textAlign: 'left'
                }}>...</span>
              </span>
            )}
            {loading && !isAISpeaking && !isListening && (
              <span style={{ fontSize: '14px', color: '#FFC107', fontStyle: 'italic' }}>
                ⏳ Analyzing your answer<span style={{
                  animation: 'ellipsis 1.5s infinite',
                  display: 'inline-block',
                  width: '20px',
                  textAlign: 'left'
                }}>...</span>
              </span>
            )}
          </div>
          <p style={{
            marginTop: '0px', fontSize: '16px',
            color: '#fff',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            minHeight: '50px'
          }}>
            {liveTranscript || finalAnswer || '(Waiting for you to speak...)'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Interview;