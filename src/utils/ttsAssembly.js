// Force FEMALE voice for ALL speech

export const speakQuestion = async (text) => {
  return new Promise((resolve) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.5;  // Higher pitch for female voice
      utterance.volume = 1.0;

      // Wait for voices to be loaded
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        
        if (voices.length === 0) {
          console.log('Voices still loading...');
          return null;
        }
        
        // Priority 1: Indian English Female voice (Google, Microsoft, or any)
        let selectedVoice = voices.find(v => 
          (v.lang === 'en-IN' || v.lang.startsWith('en-IN')) &&
          v.name.toLowerCase().includes('female')
        );
        
        // Priority 2: Indian English voice (any)
        if (!selectedVoice) {
          selectedVoice = voices.find(v => 
            v.lang === 'en-IN' || v.lang.startsWith('en-IN')
          );
        }
        
        // Priority 3: Female Google voice (US/UK English)
        if (!selectedVoice) {
          selectedVoice = voices.find(v => 
            v.name.includes('Google') && v.name.toLowerCase().includes('female')
          );
        }
        
        // Priority 4: Any explicit female voice
        if (!selectedVoice) {
          selectedVoice = voices.find(v => 
            v.name.toLowerCase().includes('female') && v.lang.startsWith('en')
          );
        }
        
        // Priority 5: Female voices without male in name
        if (!selectedVoice) {
          selectedVoice = voices.find(v => 
            !v.name.toLowerCase().includes('male') && 
            v.lang.startsWith('en') &&
            !v.name.toLowerCase().includes('samantha')
          );
        }
        
        // Last resort: Use voices[1] or [0] if available
        if (!selectedVoice && voices.length > 1) {
          selectedVoice = voices[1];
        }
        if (!selectedVoice && voices.length > 0) {
          selectedVoice = voices[0];
        }
        
        return selectedVoice;
      };
      
      // Try to load voices, with fallback
      let selectedVoice = loadVoices();
      if (!selectedVoice && window.speechSynthesis.onvoiceschanged) {
        window.speechSynthesis.onvoiceschanged = () => {
          selectedVoice = loadVoices();
          if (selectedVoice) utterance.voice = selectedVoice;
        };
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log('🎤 Voice:', selectedVoice.name);
      }

      utterance.onend = () => {
        console.log('✅ Speaking finished');
        resolve();
      };

      utterance.onerror = (e) => {
        console.error('❌ TTS error:', e.error);
        resolve();
      };

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('❌ Exception:', error);
      resolve();
    }
  });
};

export const speakCasualFeedback = (text) => speakQuestion(text);
export const stopSpeaking = () => window.speechSynthesis.cancel();

// KEEP LISTENING - NO AUTO STOP
export const startAssemblyAIListening = (onTranscriptUpdate, onFinish) => {
  return new Promise((resolve) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition not supported');
      resolve(null);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;  // KEEP LISTENING
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let fullTranscript = '';
    let lastInterimText = '';

    recognition.onstart = () => {
      console.log('🎤 LISTENING STARTED - WILL NOT AUTO-STOP');
    };

    recognition.onresult = (event) => {
      console.log('📝 onresult triggered');
      
      // Process all results from this event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;

        console.log(`${isFinal ? '✓ FINAL' : '~ interim'}: "${transcript}"`);

        if (isFinal) {
          // Add final result to full transcript
          fullTranscript += (fullTranscript ? ' ' : '') + transcript;
          lastInterimText = '';
        } else {
          // Update interim for live display
          lastInterimText = transcript;
        }
      }

      // Show live transcript (final + interim)
      const display = fullTranscript + (lastInterimText ? ' ' + lastInterimText : '');
      console.log('📺 Display:', display);
      onTranscriptUpdate(display);
    };

    recognition.onerror = (event) => {
      console.error('❌ Recognition error:', event.error);
      // DON'T STOP on error - keep listening
    };

    recognition.onend = () => {
      console.log('🏁 Recognition onend called');
      console.log('✅ FINAL FULL ANSWER:', fullTranscript);
      
      if (fullTranscript.trim()) {
        onFinish(fullTranscript.trim());
      } else {
        onFinish('');
      }
      
      resolve(recognition);
    };

    // START and NEVER STOP until user clicks Submit
    recognition.start();
    console.log('▶️ Recognition.start() called');
    
    resolve(recognition);
  });
};