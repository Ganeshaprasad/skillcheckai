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
    <div style={{
      height: '100vh', background: '#1a1a1a', color: 'white',
      display: 'flex', padding: '20px', gap: '20px'
    }}>
      {/* LEFT: Camera - BACK TO 400px */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', position: 'relative'
      }}>
        <div style={{
          position: 'absolute', top: 20, left: 20,
          fontSize: '24px', fontWeight: 'bold', background: 'rgba(0,0,0,0.7)',
          padding: '10px 20px', borderRadius: '10px'
        }}>
          ⏱️ {formatTime(timeLeft)}
        </div>

        {/* CAMERA - 400px (not overlapping) */}
        <video
          ref={videoRef}
          autoPlay muted
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

        {/* NO INDICATORS BELOW CAMERA - Moved to right panel */}

        <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
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
            <X size={20} /> Quit
          </button>
        </div>
      </div>

      {/* RIGHT: Transcript with Status */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.05)', borderRadius: '20px',
        padding: '30px', border: '2px solid #0078d4', gap: '20px'
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

        {/* Status in Transcript Area */}
        {isAISpeaking && (
          <div style={{
            padding: '15px',
            background: 'rgba(255, 152, 0, 0.2)',
            border: '2px solid #FF9800',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#FFB74D'
          }}>
            🎙️ AI is asking the question...
          </div>
        )}

        {isListening && !isAISpeaking && (
          <div style={{
            padding: '15px',
            background: 'rgba(76, 175, 80, 0.2)',
            border: '2px solid #4CAF50',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#81C784'
          }}>
            🎤 Listening to your answer...
          </div>
        )}

        <div style={{
          padding: '20px', background: 'rgba(255,255,255,0.1)',
          borderRadius: '15px', flex: 1, overflowY: 'auto',
          minHeight: '200px'
        }}>
          <strong style={{ fontSize: '14px', color: '#aaa' }}>YOUR RESPONSE:</strong>
          <p style={{
            marginTop: '10px', fontSize: '16px',
            color: isListening ? '#4CAF50' : '#fff',
            fontStyle: isListening ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6'
          }}>
            {liveTranscript || finalAnswer || '(Waiting for you to speak...)'}
          </p>
        </div>

        {loading && (
          <div style={{
            color: '#FFC107',
            textAlign: 'center',
            fontWeight: 'bold',
            padding: '12px',
            background: 'rgba(255, 193, 7, 0.2)',
            borderRadius: '10px'
          }}>
            ⏳ Analyzing your answer...
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default Interview;