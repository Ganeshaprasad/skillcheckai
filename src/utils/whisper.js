// Whisper API Integration for High-Accuracy Speech-to-Text
// Cost: $0.006 per minute of audio

// Record audio from existing stream (don't request new one)
export const recordAudioFromStream = async (existingStream) => {
  try {
    // Use the audio tracks from existing stream
    const audioTracks = existingStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio tracks available in stream');
    }

    // Create new stream with only audio tracks (don't stop them)
    const audioStream = new MediaStream(audioTracks);
    
    const mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };

    mediaRecorder.start();
    console.log('🎤 Recording started from existing stream');

    return {
      stop: async () => {
        return new Promise((resolve) => {
          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            console.log('⏹️ Recording stopped');
            resolve(audioBlob);
          };
          mediaRecorder.stop();
        });
      },
      cancel: () => {
        mediaRecorder.stop();
        console.log('❌ Recording cancelled');
      }
    };
  } catch (error) {
    console.error('❌ Audio recording error:', error);
    throw new Error('Could not access audio. Please check permissions.');
  }
};

// Legacy function for backward compatibility
export const recordAudio = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100  // High quality audio
    }});

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };

    mediaRecorder.start();
    console.log('🎤 Recording started');

    return {
      stop: async () => {
        return new Promise((resolve) => {
          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            // Stop all tracks to free resources
            stream.getTracks().forEach(track => track.stop());
            console.log('⏹️ Recording stopped');
            resolve(audioBlob);
          };
          mediaRecorder.stop();
        });
      },
      cancel: () => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        console.log('❌ Recording cancelled');
      }
    };
  } catch (error) {
    console.error('❌ Microphone access error:', error);
    throw new Error('Could not access microphone. Please check permissions.');
  }
};

export const transcribeAudio = async (audioBlob) => {
  try {
    const apiKey = process.env.REACT_APP_OPENAI_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Add REACT_APP_OPENAI_KEY to .env.local');
    }

    console.log('🔄 Sending audio to Whisper API...');
    const startTime = Date.now();

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');  // English for high accuracy
    formData.append('temperature', '0');  // More deterministic for technical terms

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ API Error:', error);
      throw new Error(error.error?.message || 'Transcription failed');
    }

    const result = await response.json();
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`✅ Transcription complete (${duration.toFixed(1)}s):`);
    console.log('📝 Text:', result.text);
    console.log('📊 Confidence: Very High (Whisper AI)');

    return {
      text: result.text,
      success: true
    };
  } catch (error) {
    console.error('❌ Transcription Error:', error);
    return {
      text: '',
      success: false,
      error: error.message
    };
  }
};

// Live transcription with existing stream
export const startLiveTranscription = async (onTranscriptUpdate, existingStream = null) => {
  try {
    let recordingSession;
    
    if (existingStream) {
      // Use existing stream from camera (preferred)
      recordingSession = await recordAudioFromStream(existingStream);
      console.log('✅ Using existing camera stream for audio');
    } else {
      // Request new stream only if no existing one provided
      recordingSession = await recordAudio();
      console.log('✅ Requested new audio stream');
    }
    
    // Signal that recording has started
    onTranscriptUpdate('');

    return {
      stop: async () => {
        try {
          // Stop recording and get audio blob
          const audioBlob = await recordingSession.stop();
          
          console.log('📊 Audio blob created, size:', audioBlob.size, 'bytes');
          
          if (audioBlob.size === 0) {
            console.warn('⚠️ Audio blob is empty!');
            return '';
          }
          
          // Show processing status
          onTranscriptUpdate('🔄 Processing...');
          
          // Transcribe the audio
          const result = await transcribeAudio(audioBlob);
          
          // Update UI with final transcript
          if (result.success) {
            console.log('✅ Transcription successful:', result.text);
            onTranscriptUpdate(result.text);
            return result.text;
          } else {
            console.warn('⚠️ Transcription failed:', result.error);
            // Return empty string on error instead of crashing
            onTranscriptUpdate('');
            return '';
          }
        } catch (error) {
          console.error('❌ Error stopping recording:', error);
          onTranscriptUpdate('');
          return '';
        }
      },
      cancel: () => {
        try {
          recordingSession.cancel();
          console.log('❌ Recording cancelled');
        } catch (e) {
          console.log('Cancel already done');
        }
      }
    };
  } catch (error) {
    console.error('❌ Error in startLiveTranscription:', error);
    // Don't throw - return a dummy session that returns empty
    return {
      stop: async () => {
        console.warn('⚠️ Recording session failed, returning empty');
        onTranscriptUpdate('');
        return '';
      },
      cancel: () => {
        console.log('Cancel called on failed session');
      }
    };
  }
};
