import React, { useEffect, useRef, useState } from 'react';
import { speakQuestion, stopSpeaking, speakCasualFeedback } from '../utils/ttsAssembly';
import { getFollowUpQuestion } from '../utils/api';
import { startLiveTranscription } from '../utils/whisper';
import {
  getInitialFeedback,
  getNoAnswerFeedback,
  getTransitionMessage,
  getCompletionMessage
} from '../utils/feedbackMessages';

const Interview = ({ topic, duration, questions, onFinish, onQuit }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalAnswer, setFinalAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [followUpAskedForQ, setFollowUpAskedForQ] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [hasStartedAsking, setHasStartedAsking] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const idleTimeoutRef = useRef(null);

  useEffect(() => {
    // Setup camera immediately - don't wait
    const setupCamera = async () => {
      try {
        console.log('📷 Setting up camera NOW...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        console.log('✅ Stream ready:', {
          video: stream.getVideoTracks().length,
          audio: stream.getAudioTracks().length
        });
        
        streamRef.current = stream;
        
        // Attach to video element immediately
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.error('Play error:', e));
          };
        }
      } catch (err) {
        console.error('❌ Camera setup failed:', err.message);
        alert('❌ Camera/Mic permission denied.\nPlease:\n1. Reload page\n2. Allow camera access\n3. Try again');
      }
    };

    // Start camera setup immediately
    setupCamera();

    // Start timer - delay first question by 3-4 seconds
    const questionTimer = setTimeout(() => {
      console.log('⏰ Time to ask first question');
      setHasStartedAsking(true);
    }, 3500);

    // Timer for countdown
    const timerId = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerId);
          handleTimeUp();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(questionTimer);
      clearInterval(timerId);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const askQuestion = async () => {
      // Only start asking after delay period
      if (!hasStartedAsking) return;
      
      try {
        console.log(`\n🎯 Q${currentQ + 1}: ${questions[currentQ]}`);
        setCurrentQuestionText(questions[currentQ]);
        setLiveTranscript('');
        setFinalAnswer('');
        setLoading(false);
        setIsAISpeaking(true);
        setIsListening(false);
        setFollowUpAskedForQ(false);

        // Stop any existing recognition
        if (recognitionRef.current) {
          try {
            if (recognitionRef.current.cancel) recognitionRef.current.cancel();
            recognitionRef.current = null;
          } catch (e) {
            console.log('Recognition cleanup');
          }
        }

        await speakQuestion(questions[currentQ]);
        setIsAISpeaking(false);
        
        await new Promise(r => setTimeout(r, 2000));
        await startListeningHandler();
      } catch (error) {
        console.error('❌ Question error:', error.message);
        setIsAISpeaking(false);
        // Continue to next question to prevent crash
        setCurrentQ(c => c + 1);
      }
    };

    if (questions[currentQ] && hasStartedAsking && currentQ < questions.length) {
      askQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, questions, hasStartedAsking, answers, topic, onQuit, onFinish]);

  const stopCamera = () => {
    if (recognitionRef.current) {
      try {
        // Handle both Whisper (has cancel method) and Speech Recognition API (has abort method)
        if (recognitionRef.current.cancel) {
          recognitionRef.current.cancel();
        } else if (recognitionRef.current.abort) {
          recognitionRef.current.abort();
        }
      } catch (e) {
        console.log('Recording/Recognition stopped');
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

  const handleTimeUp = async () => {
    if (recognitionRef.current && recognitionRef.current.stop) {
      try {
        await recognitionRef.current.stop();
      } catch (e) {
        console.log('Recording stopped');
      }
    }
    setIsListening(false);
    setIsAISpeaking(true);
    await speakCasualFeedback(getCompletionMessage());
    setIsAISpeaking(false);
    await new Promise(r => setTimeout(r, 1000));
    stopCamera();
    onFinish(answers, finalAnswer || liveTranscript);
  };

  const startListeningHandler = async () => {
    try {
      setIsListening(true);
      setLiveTranscript('');
      setFinalAnswer('');
      console.log('🎤 Listening started');

      if (!streamRef.current) {
        console.error('❌ No stream available');
        setIsListening(false);
        alert('Camera not ready. Please try again.');
        return;
      }
      
      console.log('📊 Using stream with', streamRef.current.getTracks().length, 'tracks');
      
      let session;
      try {
        session = await startLiveTranscription((transcript) => {
          if (transcript && transcript.trim() && !transcript.includes('Listening')) {
            setLiveTranscript(transcript);
          }
        }, streamRef.current);
      } catch (sessionError) {
        console.error('❌ Session error:', sessionError.message);
        setIsListening(false);
        alert('Microphone error. Check permissions and try again.');
        return;
      }

      if (!session) {
        console.error('❌ Session is null');
        setIsListening(false);
        return;
      }

      recognitionRef.current = session;

      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('⏱️ Idle timeout - quitting');
          recognitionRef.current?.cancel?.();
          setIsListening(false);
          stopCamera();
          onQuit(answers);
        } catch (e) {
          console.error('Timeout error:', e);
        }
      }, 10000);

    } catch (error) {
      console.error('❌ startListeningHandler error:', error.message);
      setIsListening(false);
      alert('Error: ' + error.message);
    }
  };

  const handleSubmitAnswer = async () => {
    try {
      console.log('📤 Submitting answer...');
      
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      
      if (!recognitionRef.current) {
        console.warn('⚠️ No recording session');
        setIsListening(false);
        alert('Please speak first.');
        return;
      }

      setIsListening(false);
      setLoading(true);

      let answer = '';
      
      if (recognitionRef.current && recognitionRef.current.stop) {
        try {
          console.log('⏹️ Stopping Whisper...');
          const whisperTranscript = await recognitionRef.current.stop();
          
          if (whisperTranscript && whisperTranscript.trim()) {
            answer = whisperTranscript;
            console.log('✅ Whisper got:', answer.substring(0, 80));
          } else {
            console.warn('⚠️ Empty Whisper result');
            answer = liveTranscript.trim() || '';
          }
        } catch (whisperError) {
          console.error('❌ Whisper stop error:', whisperError.message);
          answer = liveTranscript.replace('🎤 Listening', '').trim() || '';
        }
      }

      console.log('📊 Answer length:', answer.length);

      if (!answer || answer.length < 3) {
        console.warn('⚠️ Too short - retry');
        setLoading(false);
        await new Promise(r => setTimeout(r, 700));
        await startListeningHandler();
        return;
      }

      const cleanAnswer = answer.trim();
      const newAnswers = [...answers, { q: currentQ, question: currentQuestionText, ans: cleanAnswer }];
      setAnswers(newAnswers);

      const isNoAnswer = cleanAnswer.toLowerCase().includes('dont know') || 
                         cleanAnswer.toLowerCase().includes("don't know") ||
                         cleanAnswer.toLowerCase().includes('not sure') ||
                         cleanAnswer.length < 5;

      if (isNoAnswer) {
        setLoading(false);
        setIsAISpeaking(true);
        await speakCasualFeedback(getNoAnswerFeedback());
        setIsAISpeaking(false);

        if (currentQ < questions.length - 1 && timeLeft > 5) {
          await new Promise(r => setTimeout(r, 1000));
          setIsAISpeaking(true);
          await speakCasualFeedback(getTransitionMessage(currentQ, questions.length));
          setIsAISpeaking(false);
          
          setLiveTranscript('');
          setFinalAnswer('');
          await new Promise(r => setTimeout(r, 1500));
          setCurrentQ(c => c + 1);
        } else {
          await speakCasualFeedback(getCompletionMessage());
          setIsAISpeaking(false);
          await new Promise(r => setTimeout(r, 1000));
          stopCamera();
          onFinish(newAnswers, cleanAnswer);
        }
      } else {
        // Good answer - try to get follow-up (but only 1 per question)
        setLoading(false);
        
        try {
          if (!followUpAskedForQ) {
            console.log('🔍 Getting follow-up...');
            const followUpResponse = await getFollowUpQuestion(topic, questions[currentQ], cleanAnswer);

            if (followUpResponse) {
              setFollowUpAskedForQ(true);
              setIsAISpeaking(true);
              
              if (followUpResponse.type === 'rephrase') {
                console.log('🔄 Rephrasing...');
                setCurrentQuestionText(followUpResponse.text);
                await speakCasualFeedback(getNoAnswerFeedback());
                await new Promise(r => setTimeout(r, 500));
               await speakQuestion(followUpResponse.text);
                setIsAISpeaking(false);
                setLiveTranscript('');
                await new Promise(r => setTimeout(r, 2000));
                await startListeningHandler();
                return;
              } else if (followUpResponse.type === 'followup') {
                console.log('📝 Following up...');
                setCurrentQuestionText(followUpResponse.text);
                await speakCasualFeedback(getInitialFeedback(cleanAnswer));
                await new Promise(r => setTimeout(r, 500));
                await speakQuestion(followUpResponse.text);
                setIsAISpeaking(false);
                setLiveTranscript('');
                await new Promise(r => setTimeout(r, 2000));
                await startListeningHandler();
                return;
              }
            }
          }

          setIsAISpeaking(true);
          await speakCasualFeedback(getInitialFeedback(cleanAnswer));
          
          if (currentQ < questions.length - 1 && timeLeft > 5) {
            await new Promise(r => setTimeout(r, 500));
            await speakCasualFeedback(getTransitionMessage(currentQ, questions.length));
            setIsAISpeaking(false);
            await new Promise(r => setTimeout(r, 1500));
            setCurrentQ(c => c + 1);
          } else {
            await new Promise(r => setTimeout(r, 500));
            await speakCasualFeedback(getCompletionMessage());
            setIsAISpeaking(false);
            await new Promise(r => setTimeout(r, 1000));
            stopCamera();
            onFinish(newAnswers, cleanAnswer);
          }
          setLiveTranscript('');
        } catch (followUpError) {
          console.error('❌ Follow-up error:', followUpError.message);
          setIsAISpeaking(false);
          setLoading(false);
          // Continue to next question anyway
          setCurrentQ(c => c + 1);
        }
      }
    } catch (error) {
      console.error('❌ handleSubmitAnswer error:', error.message);
      setLoading(false);
      setIsAISpeaking(false);
      setIsListening(false);
      alert('Error occurred. Continuing to next question...');
      setCurrentQ(c => c + 1);
    }
  };

  const handleQuit = () => {
    setShowQuitConfirm(true);
  };

  const confirmQuit = async () => {
    stopCamera();
    onQuit(answers);  // Pass answers count for feedback
  };

  const cancelQuit = () => {
    setShowQuitConfirm(false);
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
          autoPlay 
          muted
          playsInline
          className="video-stream"
          style={{
            width: '400px', height: '400px', objectFit: 'cover',
            borderRadius: '20px',
            border: isListening ? '3px solid #4CAF50' : '3px solid #0078d4',
            boxShadow: isListening ? '0 0 30px rgba(76, 175, 80, 0.6)' : '0 0 20px rgba(0, 120, 212, 0.5)',
            transform: 'scaleX(-1)',
            transition: 'all 0.3s ease',
            opacity: isAISpeaking ? 0.8 : 1,
            backgroundColor: '#000000',
            display: 'block'
          }}
        />

        <div className="button-group" style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
          <button
            onClick={handleSubmitAnswer}
            disabled={!isListening || isAISpeaking || loading}
            style={{
              padding: '15px 30px', fontSize: '16px',
              background: (isListening && !isAISpeaking && !loading) ? '#0078d4' : '#666',
              color: 'white', border: 'none', borderRadius: '25px',
              cursor: (isListening && !isAISpeaking && !loading) ? 'pointer' : 'not-allowed',
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
          <p style={{ fontSize: '16px', marginTop: '0px', color: '#fff', lineHeight: '1.6' }}>
            {currentQuestionText || questions[currentQ]}
          </p>
        </div>

        <div style={{
          padding: '20px', background: 'rgba(255,255,255,0.1)',
          borderRadius: '15px', flex: 1, overflowY: 'auto',
          minHeight: '200px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', minHeight: '28px' }}>
            {isAISpeaking ? (
              <span style={{ fontSize: '14px', color: '#FFB74D', fontStyle: 'italic', fontWeight: 'bold' }}>
                🎙️ AI is asking...
              </span>
            ) : isListening && !loading ? (
              <span style={{ fontSize: '14px', color: '#4CAF50', fontStyle: 'italic', fontWeight: 'bold' }}>
                🎤 Listening
              </span>
            ) : loading ? (
              <span style={{ fontSize: '14px', color: '#FFC107', fontStyle: 'italic', fontWeight: 'bold' }}>
                ⏳ Processing
              </span>
            ) : (liveTranscript || finalAnswer) ? (
              <strong style={{ fontSize: '14px', color: '#aaa' }}>YOUR RESPONSE:</strong>
            ) : null}
          </div>
          <p style={{
            marginTop: '0px', fontSize: '16px',
            color: '#fff',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            minHeight: '50px'
          }}>
            {liveTranscript || finalAnswer}
          </p>
        </div>
      </div>

      {/* Quit Confirmation Modal */}
      {showQuitConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a1a', padding: '40px', borderRadius: '20px',
            border: '2px solid #0078d4', maxWidth: '500px', textAlign: 'center',
            color: 'white'
          }}>
            <h2 style={{ marginTop: 0, color: '#0078d4' }}>Interview Summary</h2>
            
            <div style={{
              background: 'rgba(0,120,212,0.2)', padding: '20px',
              borderRadius: '15px', marginBottom: '25px', fontSize: '18px'
            }}>
              <strong>Questions Asked: {answers.length}</strong>
              <p style={{ marginTop: '10px', fontSize: '14px', color: '#aaa' }}>
                You answered {answers.length} question{answers.length !== 1 ? 's' : ''} during this interview.
              </p>
            </div>

            <p style={{ marginBottom: '30px', fontSize: '16px', color: '#ccc' }}>
              Are you sure you want to quit the interview?
            </p>

            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={confirmQuit}
                style={{
                  padding: '12px 30px', fontSize: '16px',
                  background: '#a4262e', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Yes, Quit
              </button>
              <button
                onClick={cancelQuit}
                style={{
                  padding: '12px 30px', fontSize: '16px',
                  background: '#0078d4', color: 'white', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Continue Interview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;