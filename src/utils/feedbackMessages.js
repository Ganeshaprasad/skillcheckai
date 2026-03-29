// Varied, natural feedback messages to make interview feel conversational

export const getInitialFeedback = (answer) => {
  const responses = [
    'That makes sense.',
    'I see your point.',
    'Interesting approach.',
    'Got it.',
    'Thank you for that answer.',
    'Understood.',
    'Good explanation.',
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

export const getFollowUpRequest = (answer) => {
  const isBasicAnswer = answer.length < 50 || (!answer.includes('because') && !answer.includes('example'));
  
  const requests = {
    basic: [
      'Can you elaborate a bit more on that?',
      'Walk me through how you would do that?',
      'Give me an example of how you\'d apply that?',
      'What specific methods would you use?',
      'How would you implement that?',
    ],
    detailed: [
      'Any real-world examples you\'ve encountered?',
      'How does that relate to best practices?',
      'What are some edge cases you\'ve experienced?',
      'How would you extend that approach?',
      'What might be the challenges there?',
    ]
  };
  
  const list = isBasicAnswer ? requests.basic : requests.detailed;
  return list[Math.floor(Math.random() * list.length)];
};

export const getNoAnswerFeedback = () => {
  const responses = [
    'No problem, that\'s alright.',
    'That\'s okay, let\'s move on.',
    'No worries about this one.',
    'It\'s totally fine if that\'s not your area.',
    'No pressure, let\'s try another angle.',
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

export const getTransitionMessage = (questionIndex, totalQuestions) => {
  const transitions = [
    'Let\'s move to the next one.',
    'Moving on to another question.',
    'Here\'s a new question for you.',
    'Let\'s continue.',
    'Next up:',
    'Here\'s another one:',
  ];
  return transitions[Math.floor(Math.random() * transitions.length)];
};

export const getCompletionMessage = () => {
  const messages = [
    'Thank you for the interview. Let me review your responses.',
    'That was great! Let me analyze your answers.',
    'I appreciate your time. Let me go through your responses.',
    'Excellent. Let me review what we discussed.',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};

export const getUnderstandingRequest = () => {
  const requests = [
    'Could you explain that differently?',
    'Help me understand that better?',
    'Can you put that in simpler terms?',
    'Walk me through that again?',
    'What do you mean by that?',
  ];
  return requests[Math.floor(Math.random() * requests.length)];
};
