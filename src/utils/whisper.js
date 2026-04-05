// Whisper API — raw fetch (most reliable for browser multipart uploads)

export const transcribeAudio = async (audioBlob) => {
  const apiKey = process.env.REACT_APP_OPENAI_KEY;

  if (!apiKey) {
    console.error('❌ No OpenAI API key');
    return { text: '', success: false, error: 'No API key' };
  }

  // Force simple audio/webm type — strip codec suffix that confuses some APIs
  const cleanBlob = new Blob([audioBlob], { type: 'audio/webm' });
  console.log('🔄 Whisper upload — size:', cleanBlob.size, 'bytes');

  if (cleanBlob.size < 500) {
    return { text: '', success: false, error: 'Audio too short' };
  }

  try {
    const formData = new FormData();
    // Append as Blob with filename — DO NOT set Content-Type header manually
    formData.append('file', cleanBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        // Only Authorization — browser sets Content-Type with multipart boundary
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        errMsg = errBody?.error?.message || errMsg;
        console.error('❌ Whisper API error response:', errBody);
      } catch (e) {
        console.error('❌ Whisper HTTP error:', response.status, response.statusText);
      }
      return { text: '', success: false, error: errMsg };
    }

    const data = await response.json();
    console.log(`✅ Whisper done (${elapsed}s):`, data.text);

    return { text: data.text || '', success: true };
  } catch (err) {
    console.error('❌ Whisper fetch error:', err.name, err.message);
    return { text: '', success: false, error: `${err.name}: ${err.message}` };
  }
};

