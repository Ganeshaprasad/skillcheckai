import React, { useState } from 'react';
import Select from 'react-select';

const Home = ({ onStart }) => {
  const [topic, setTopic] = useState(null);
  const [duration, setDuration] = useState(null);
  const [error, setError] = useState('');

  const topics = [
    { value: 'selenium', label: 'Selenium Automation' },
    { value: 'api', label: 'REST Assured / API' },
    { value: 'manual', label: 'Manual Testing' }
  ];

  const times = [
    { value: 10, label: '10 minutes' },
    { value: 20, label: '20 minutes' }
  ];

  const handleStart = () => {
    setError('');
    if (!topic) {
      setError('Please select a topic');
      return;
    }
    if (!duration) {
      setError('Please select duration');
      return;
    }
    onStart({ topic: topic.value, duration: duration.value });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ maxWidth: '500px', width: '100%', background: '#2d2d2d', padding: '40px', borderRadius: '15px', border: '2px solid #0078d4' }}>
        <h1 style={{ textAlign: 'center', color: '#0078d4', marginBottom: '30px' }}>AI Mock Interview</h1>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#90CAF9', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Topic</label>
          <Select options={topics} onChange={setTopic} placeholder="Choose" />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#90CAF9', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>Duration</label>
          <Select options={times} onChange={setDuration} placeholder="Choose" />
        </div>
        {error && <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}
        <button onClick={handleStart} disabled={!topic || !duration} style={{ width: '100%', padding: '12px', fontSize: '16px', background: topic && duration ? '#0078d4' : '#666', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Start</button>
      </div>
    </div>
  );
};

export default Home;