import React, { useEffect, useRef, useState, useCallback } from 'react';
import { speakQuestion, stopSpeaking, speakCasualFeedback } from '../utils/ttsAssembly';
import { getFollowUpQuestion, transcribeAudio } from '../utils/api';
import {
  getInitialFeedback,
  getCompletionMessage
} from '../utils/feedbackMessages';

const Interview = ({ topic, duration, questions, onFinish }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [currentQuestionText, setCurrentQuestionText] = useState('');
  const [hasStartedAsking, setHasStartedAsking] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timeUpHandledRef = useRef(false);
  const isTimeUpRef = useRef(false);
  const lastAskedQRef = useRef(-1);
  const answersRef = useRef([]);
  const isSubmittingRef = useRef(false);
  const followUpAskedForQRef = useRef(-1);
  const recordingTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const levelIntervalRef = useRef(null);

  // ========================
  // CAMERA SETUP + TIMER
  // ========================
  useEffect(() => {
    const setupCamera = async () => {
      try {
        // Video ONLY — mic is requested separately in startListening so there's no conflict
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
          };
        }
      } catch (err) {
        alert('Camera permission denied. Please reload and allow access.');
      }
    };

    setupCamera();

    // Warm-up mic permission check so browser grants it before first question
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => { s.getTracks().forEach(t => t.stop()); console.log('✅ Mic permission granted'); })
      .catch(e => { alert('Microphone permission denied. Please reload and allow mic access.'); });

    const questionTimer = setTimeout(() => {
      setHasStartedAsking(true);
    }, 3500);

    const timerId = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerId);
          if (!timeUpHandledRef.current) {
            timeUpHandledRef.current = true;
            isTimeUpRef.current = true;
            setIsTimeUp(true);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(questionTimer);
      clearInterval(timerId);
      cleanupAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========================
  // ASK QUESTION
  // ========================
  const askQuestionFlow = useCallback(async (qIndex) => {
    if (lastAskedQRef.current === qIndex) return;
    if (qIndex >= questions.length) return;

    console.log(`\n🎯 ASK Q${qIndex + 1}: ${questions[qIndex]}`);
    lastAskedQRef.current = qIndex;

    setLiveTranscript('');
    setLoading(false);
    setIsListening(false);
    setCurrentQuestionText(questions[qIndex]);

    setIsAISpeaking(true);
    stopSpeaking();
    try { await speakQuestion(questions[qIndex]); } catch (e) {}
    setIsAISpeaking(false);

    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  useEffect(() => {
    if (hasStartedAsking && currentQ < questions.length) {
      askQuestionFlow(currentQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ, hasStartedAsking]);

  // ========================
  // CLEANUP
  // ========================
  const cleanupAll = () => {
    stopRecording();
    stopSpeaking();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    mediaRecorderRef.current = null;
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ========================
  // START LISTENING — Separate audio stream + MediaRecorder for Whisper
  // ========================
  const startListening = async () => {
    stopRecording();
    setLiveTranscript('');
    setRecordingTime(0);
    setAudioLevel(0);
    audioChunksRef.current = [];

    try {
      // Request a SEPARATE audio-only stream (not shared with camera)
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      audioStreamRef.current = audioStream;

      // Set up audio level monitoring via AudioContext
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(audioStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        levelIntervalRef.current = setInterval(() => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(Math.min(100, Math.round(avg * 2)));
          }
        }, 150);
      } catch (e) {
        console.warn('AudioContext not available for level monitoring');
      }

      // Create MediaRecorder with MIME type fallback
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(audioStream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setLiveTranscript(`⚠️ Recording error: ${e.error?.message || 'Unknown'}`);
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsListening(true);

      console.log(`🎤 Recording started — MIME: ${recorder.mimeType}, separate audio stream`);

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (e) {
      console.error('Failed to start recording:', e);
      setLiveTranscript(`⚠️ Mic access failed: ${e.message}`);
    }
  };

  // ========================
  // SUBMIT ANSWER
  // ========================
  const handleSubmitAnswer = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    // Stop listening immediately
    setIsListening(false);
    setLoading(true);

    // Stop timers
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    setAudioLevel(0);

    // Stop MediaRecorder and collect audio blob
    let answer = '';
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      // Wait for recorder to stop and fire final ondataavailable
      await new Promise(resolve => {
        recorder.onstop = resolve;
        recorder.stop();
      });
    }
    mediaRecorderRef.current = null;

    // Stop the separate audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Create blob from recorded chunks
    const chunks = audioChunksRef.current;
    const blobType = recorder?.mimeType || 'audio/webm';
    const audioBlob = new Blob(chunks, { type: blobType });
    console.log(`📊 Audio blob: ${chunks.length} chunks, ${audioBlob.size} bytes, type: ${blobType}`);

    if (audioBlob.size < 1000) {
      console.warn('⚠️ Audio blob too small — no audio captured');
      setLiveTranscript('⚠️ No audio captured — check microphone');
      answer = '';
    } else {
      // Send to Whisper API
      setLiveTranscript('🔄 Transcribing with Whisper...');
      const result = await transcribeAudio(audioBlob);
      if (result.success && result.text && result.text.trim()) {
        answer = result.text.trim();
        console.log('✅ Whisper result:', answer.substring(0, 100));
        setLiveTranscript(answer);
      } else {
        // Log exact error for debugging
        const errDetail = result.error || 'No speech detected';
        console.warn('⚠️ Whisper failed:', errDetail, '— continuing anyway');
        setLiveTranscript(`[Transcription failed: ${errDetail}]`);
        answer = '';
      }
    }

    console.log('📤 SUBMIT — Answer:', answer.substring(0, 100) || '(empty)');

    // Store answer
    const newAnswers = [...answersRef.current, {
      q: currentQ, question: currentQuestionText, ans: answer
    }];
    answersRef.current = newAnswers;
    setLoading(false);

    // Check if time's up
    if (isTimeUpRef.current) {
      console.log('🏁 Time up — finishing');
      setIsAISpeaking(true);
      try { await speakCasualFeedback(getCompletionMessage()); } catch (e) {}
      setIsAISpeaking(false);
      cleanupAll();
      isSubmittingRef.current = false;
      onFinish(answersRef.current, answer);
      return;
    }

    // Try follow-up / cross-question (max 1 per main question)
    if (answer.length >= 20 && followUpAskedForQRef.current !== currentQ) {
      try {
        console.log('🔍 Checking for follow-up...');
        const followUp = await Promise.race([
          getFollowUpQuestion(topic, questions[currentQ], answer),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
        ]);

        if (followUp && (followUp.type === 'followup' || followUp.type === 'rephrase')) {
          followUpAskedForQRef.current = currentQ;
          console.log('📝 Follow-up:', followUp.text.substring(0, 60));

          setIsAISpeaking(true);
          try {
            await speakCasualFeedback(getInitialFeedback(answer));
          } catch (e) {}
          setCurrentQuestionText(followUp.text);
          try {
            await speakQuestion(followUp.text);
          } catch (e) {}
          setIsAISpeaking(false);

          // Reset transcript and listen for follow-up answer
          setLiveTranscript('');
          isSubmittingRef.current = false;
          startListening();
          return;
        }
      } catch (e) {
        console.warn('Follow-up skipped:', e.message);
      }
    }

    // Check if last question
    if (currentQ >= questions.length - 1) {
      console.log('🏁 Last question — finishing');
      setIsAISpeaking(true);
      try { await speakCasualFeedback(getCompletionMessage()); } catch (e) {}
      setIsAISpeaking(false);
      cleanupAll();
      isSubmittingRef.current = false;
      onFinish(answersRef.current, answer);
      return;
    }

    // Brief feedback
    if (answer.length > 0) {
      setIsAISpeaking(true);
      try { await speakCasualFeedback(getInitialFeedback(answer)); } catch (e) {}
      setIsAISpeaking(false);
    }

    // Advance to next question
    console.log('➡️ Next question');
    isSubmittingRef.current = false;
    lastAskedQRef.current = -1;
    setCurrentQ(prev => prev + 1);
  };

  // ========================
  // QUIT
  // ========================
  const handleQuit = () => setShowQuitConfirm(true);
  const cancelQuit = () => setShowQuitConfirm(false);
  const confirmQuit = () => {
    cleanupAll();
    onFinish(answersRef.current, '');
  };

  // ========================
  // RENDER
  // ========================
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
          fontSize: '24px', fontWeight: 'bold',
          background: isTimeUp ? 'rgba(220, 53, 69, 0.9)' : 'rgba(0,0,0,0.7)',
          padding: '10px 20px', borderRadius: '10px',
          color: isTimeUp ? '#fff' : 'inherit',
          border: isTimeUp ? '2px solid #ff6b6b' : 'none',
          animation: isTimeUp ? 'pulse 1s infinite' : 'none'
        }}>
          {isTimeUp ? '⏰ TIME UP - SUBMIT TO FINISH' : `⏱️ ${formatTime(timeLeft)}`}
        </div>

        <video
          ref={videoRef}
          autoPlay muted playsInline
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

      {/* RIGHT: Transcript */}
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
          borderRadius: '15px', flex: 1, overflowY: 'auto', minHeight: '200px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', minHeight: '28px' }}>
            {isAISpeaking ? (
              <span style={{ fontSize: '14px', color: '#FFB74D', fontStyle: 'italic', fontWeight: 'bold' }}>
                🎙️ AI is speaking...
              </span>
            ) : loading ? (
              <span style={{ fontSize: '14px', color: '#FFC107', fontStyle: 'italic', fontWeight: 'bold' }}>
                ⏳ Processing...
              </span>
            ) : isListening ? (
              <span style={{ fontSize: '14px', color: '#4CAF50', fontStyle: 'italic', fontWeight: 'bold' }}>
                🎤 Recording — {recordingTime}s (continuous, no limit)
                <span style={{
                  display: 'inline-block', width: '60px', height: '8px',
                  background: '#333', borderRadius: '4px', marginLeft: '10px',
                  verticalAlign: 'middle', overflow: 'hidden'
                }}>
                  <span style={{
                    display: 'block', height: '100%', borderRadius: '4px',
                    width: `${audioLevel}%`,
                    background: audioLevel > 30 ? '#4CAF50' : audioLevel > 10 ? '#FFC107' : '#666',
                    transition: 'width 0.1s'
                  }} />
                </span>
                {audioLevel < 5 && recordingTime > 2 ? ' ⚠️ No audio detected!' : ''}
              </span>
            ) : null}
          </div>
          <p style={{
            marginTop: '0px', fontSize: '16px', color: '#fff',
            whiteSpace: 'pre-wrap', lineHeight: '1.6', minHeight: '50px'
          }}>
            {liveTranscript}
          </p>
        </div>
      </div>

      {/* Quit Modal */}
      {showQuitConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a1a', padding: '40px', borderRadius: '20px',
            border: '2px solid #0078d4', maxWidth: '500px', textAlign: 'center', color: 'white'
          }}>
            <h2 style={{ marginTop: 0, color: '#0078d4' }}>Quit Interview?</h2>
            <p style={{ marginBottom: '30px', fontSize: '16px', color: '#ccc' }}>
              You answered {answersRef.current.length} question{answersRef.current.length !== 1 ? 's' : ''}. Are you sure?
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={confirmQuit} style={{
                padding: '12px 30px', fontSize: '16px', background: '#a4262e',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
              }}>Yes, Quit</button>
              <button onClick={cancelQuit} style={{
                padding: '12px 30px', fontSize: '16px', background: '#0078d4',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
              }}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;
