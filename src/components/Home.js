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
    { value: 1, label: '1 minute' },
    { value: 5, label: '5 minutes' },
    { value: 10, label: '10 minutes' }
  ];

  const customSelectStyles = {
    control: (base, state) => ({
      ...base,
      background: '#1f1f1f',
      borderColor: state.isFocused ? '#00d4ff' : '#444',
      borderWidth: '2px',
      boxShadow: state.isFocused ? '0 0 15px rgba(0, 212, 255, 0.5)' : 'none',
      color: '#fff',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      minHeight: '45px',
      ':hover': {
        borderColor: '#00d4ff',
        boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
      }
    }),
    menu: (base) => ({
      ...base,
      background: '#1f1f1f',
      border: '2px solid #00d4ff',
      boxShadow: '0 8px 32px rgba(0, 212, 255, 0.2)',
      borderRadius: '8px',
      zIndex: 10
    }),
    option: (base, state) => ({
      ...base,
      background: state.isSelected ? '#0078d4' : state.isFocused ? '#2a2a2a' : '#1f1f1f',
      color: '#fff',
      cursor: 'pointer',
      padding: '12px 15px',
      transition: 'all 0.2s ease',
      ':active': {
        background: '#0078d4'
      }
    }),
    input: (base) => ({
      ...base,
      color: '#fff'
    }),
    placeholder: (base) => ({
      ...base,
      color: '#888'
    }),
    singleValue: (base) => ({
      ...base,
      color: '#fff'
    })
  };

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
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)', 
      color: 'white', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 'clamp(10px, 5vw, 20px)',
      position: 'relative',
      overflow: 'hidden',
      width: '100%'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-10%',
        width: 'clamp(250px, 50vw, 500px)',
        height: 'clamp(250px, 50vw, 500px)',
        background: 'radial-gradient(circle, rgba(0, 212, 255, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'float 20s infinite ease-in-out'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        right: '-5%',
        width: 'clamp(200px, 40vw, 400px)',
        height: 'clamp(200px, 40vw, 400px)',
        background: 'radial-gradient(circle, rgba(0, 120, 212, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'float 25s infinite ease-in-out'
      }}></div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(30px); }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 10px rgba(0, 212, 255, 0.5); }
          50% { text-shadow: 0 0 20px rgba(0, 212, 255, 0.8); }
        }
        
        /* Mobile responsive styles */
        @media (max-width: 480px) {
          .home-container {
            padding: 20px !important;
          }
          .home-title {
            font-size: 24px !important;
            letter-spacing: 1px !important;
            margin-bottom: 8px !important;
          }
          .home-subtitle {
            font-size: 12px !important;
            margin-bottom: 25px !important;
          }
          .home-label {
            font-size: 12px !important;
            margin-bottom: 8px !important;
          }
          .home-button {
            padding: 12px !important;
            font-size: 14px !important;
          }
          .home-error {
            font-size: 12px !important;
            padding: 10px !important;
          }
        }
        
        @media (max-width: 768px) {
          .home-container {
            padding: 30px !important;
            border-radius: 15px !important;
          }
          .home-title {
            font-size: 28px !important;
          }
          .home-subtitle {
            font-size: 13px !important;
          }
        }
        
        @media (min-width: 1024px) {
          .home-container {
            padding: 50px !important;
          }
        }
      `}</style>

      <div className="home-container" style={{ 
        maxWidth: '500px', 
        width: '100%', 
        background: 'rgba(29, 31, 55, 0.8)',
        backdropFilter: 'blur(10px)',
        padding: 'clamp(20px, 8vw, 50px)', 
        borderRadius: 'clamp(12px, 3vw, 20px)', 
        border: '2px solid rgba(0, 212, 255, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 212, 255, 0.1)',
        position: 'relative',
        zIndex: 1
      }}>
        <h1 className="home-title" style={{ 
          textAlign: 'center', 
          color: '#00d4ff', 
          marginBottom: '10px',
          fontSize: 'clamp(24px, 6vw, 32px)',
          fontWeight: '700',
          letterSpacing: 'clamp(1px, 0.2vw, 2px)',
          animation: 'glow 2s ease-in-out infinite'
        }}>AI Mock Interview</h1>
        <p className="home-subtitle" style={{
          textAlign: 'center',
          color: '#90CAF9',
          fontSize: 'clamp(12px, 3vw, 14px)',
          marginBottom: '35px',
          opacity: '0.8'
        }}>Test your skills with AI-powered questions</p>

        <div style={{ marginBottom: 'clamp(15px, 4vw, 25px)' }}>
          <label className="home-label" style={{ 
            color: '#00d4ff', 
            fontWeight: '700', 
            marginBottom: '10px', 
            display: 'block',
            fontSize: 'clamp(12px, 2.5vw, 14px)',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>Topic</label>
          <Select 
            options={topics} 
            onChange={setTopic} 
            styles={customSelectStyles}
            placeholder="Select a topic..." 
            isSearchable={true}
          />
        </div>
        
        <div style={{ marginBottom: 'clamp(20px, 5vw, 30px)' }}>
          <label className="home-label" style={{ 
            color: '#00d4ff', 
            fontWeight: '700', 
            marginBottom: '10px', 
            display: 'block',
            fontSize: 'clamp(12px, 2.5vw, 14px)',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>Duration</label>
          <Select 
            options={times} 
            onChange={setDuration} 
            styles={customSelectStyles}
            placeholder="Select duration..." 
            isSearchable={false}
          />
        </div>
        
        {error && <div className="home-error" style={{ 
          color: '#ff6b6b', 
          marginBottom: '20px',
          padding: 'clamp(10px, 2vw, 12px)',
          background: 'rgba(255, 107, 107, 0.1)',
          borderLeft: '3px solid #ff6b6b',
          borderRadius: '4px',
          fontSize: 'clamp(12px, 2.5vw, 14px)',
          wordBreak: 'break-word'
        }}>{error}</div>}
        
        <button 
          className="home-button"
          onClick={handleStart} 
          disabled={!topic || !duration} 
          style={{ 
            width: '100%', 
            padding: 'clamp(12px, 3vw, 14px)', 
            fontSize: 'clamp(14px, 3vw, 16px)', 
            background: topic && duration 
              ? 'linear-gradient(135deg, #0078d4 0%, #00d4ff 100%)' 
              : '#444',
            color: 'white', 
            border: 'none', 
            borderRadius: '10px', 
            cursor: topic && duration ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease',
            boxShadow: topic && duration ? '0 8px 25px rgba(0, 212, 255, 0.3)' : 'none',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            fontWeight: '700',
            touchAction: 'manipulation'
          }}
          onMouseEnter={(e) => {
            if (topic && duration) {
              e.target.style.transform = 'translateY(-3px)';
              e.target.style.boxShadow = '0 12px 35px rgba(0, 212, 255, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (topic && duration) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 212, 255, 0.3)';
            }
          }}
        >
          Start Interview
        </button>
      </div>
    </div>
  );
};

export default Home;