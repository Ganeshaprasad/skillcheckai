import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_KEY,
  dangerouslyAllowBrowser: true
});

const questionBanks = {
  selenium: {
    easy: [
      'What is Selenium?',
      'What are the different types of locators in Selenium?',
      'What is the difference between get() and navigate().to()?',
      'What is the difference between driver.quit() and driver.close()?',
      'How do you take a screenshot in Selenium?'
    ],
    medium: [
      'Difference between Selenium 3 and Selenium 4?',
      'Difference between findElement() and findElements()?',
      'How do you handle dropdowns in Selenium?',
      'How to handle multiple windows in Selenium?',
      'How do you handle alerts and pop-ups?',
      'How do you handle frames and iframes?',
      'What are the different types of waits in Selenium?',
      'Implicit vs Explicit Wait vs Fluent wait - What is the difference?',
      'How do you scroll a webpage using Selenium?',
      'How do you handle file uploads in Selenium?',
      'What is the Page Object Model (POM)?',
      'How do you handle dynamic elements in Selenium?',
      'What are the different types of Assertions used in Selenium?',
      'How do you integrate Selenium with TestNG?'
    ],
    hard: [
      'What is Fluent Wait, and when do you use it?',
      'How do you handle StaleElementReferenceException?',
      'What is JavaScriptExecutor? How do you use it?',
      'How do you validate broken links in Selenium?',
      'How do you capture network logs in Selenium?',
      'What is Page Factory? How is it different from POM?',
      'What is the difference between @FindBy and driver.findElement()?',
      'What are Selenium Grid and its advantages?',
      'What is the role of DesiredCapabilities in Selenium?',
      'What are the limitations of Selenium WebDriver?',
      'What are TestNG Listeners, and how do you implement them?',
      'How do you run Selenium tests in headless mode?',
      'How do you handle authentication pop-ups in Selenium?',
      'How do you execute parallel tests in Selenium?',
      'How do you handle CAPTCHA in Selenium?',
      'What would you do if a Selenium test runs fine locally but fails in CI (e.g., Jenkins)?',
      'How do you debug a failing Selenium test?',
      'What steps do you take if a Selenium test intermittently fails (flaky test)?'
    ]
  },
  api: {
    easy: [
      'What is API testing and why is it important?',
      'What is REST and how is it different from SOAP?',
      'What HTTP methods do you use in API testing (GET, POST, PUT, DELETE)?',
      'How do you send query parameters in REST Assured?',
      'What tools have you used for API testing (e.g., REST Assured, Postman)?'
    ],
    medium: [
      'How do you validate response status codes in REST Assured?',
      'How do you validate JSON response body in REST Assured?',
      'How do you send path parameters in REST Assured?',
      'How do you handle Basic Authentication in API testing?',
      'What is idempotent HTTP method? Give examples.',
      'How do you handle request and response logging in REST Assured?',
      'How do you parse JSON response using REST Assured?',
      'What is the difference between assertions and validations in API testing?'
    ],
    hard: [
      'How do you design API test cases for a new endpoint?',
      'How do you handle OAuth authentication in REST Assured?',
      'What is API contract testing and how do you implement it?',
      'How do you handle dynamic response values in assertions?',
      'How do you integrate REST Assured tests into CI/CD pipeline?',
      'How do you handle flaky API tests and timeouts?',
      'What are best practices for API test data management?',
      'How do you test API performance and load testing strategies?'
    ]
  },
  manual: {
    easy: [
      'What is Software Testing and why is it important?',
      'Explain STLC (Software Testing Life Cycle).',
      'What is the difference between verification and validation?',
      'What is the difference between smoke testing and sanity testing?',
      'What is a test case? What should it contain?'
    ],
    medium: [
      'What is regression testing and when do you perform it?',
      'What is the difference between test case and test scenario?',
      'How do you write a good bug report?',
      'What is severity vs priority? Give examples.',
      'What is boundary value analysis?',
      'What is equivalence partitioning?',
      'How do you prioritize test cases?',
      'What is exploratory testing?'
    ],
    hard: [
      'Explain a critical bug you found and how you reported it.',
      'What is risk-based testing and how do you implement it?',
      'How do you handle incomplete or ambiguous requirements?',
      'What is test estimation and how do you approach it?',
      'How do you manage test cases for a complex system?',
      'What is the difference between black box and white box testing?',
      'How do you ensure test coverage for a new feature?',
      'What metrics do you track to measure testing effectiveness?'
    ]
  }
};

export const fetchQuestions = async (topic, duration) => {
  const numQuestions = duration === 10 ? 4 : 6;
  const bank = questionBanks[topic];

  if (!bank) return ['Tell me about your testing experience.'];

  const questions = [];
  const easyCount = Math.ceil(numQuestions * 0.3);
  const mediumCount = Math.ceil(numQuestions * 0.4);
  const hardCount = numQuestions - easyCount - mediumCount;

  const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

  questions.push(...shuffleArray(bank.easy).slice(0, easyCount));
  questions.push(...shuffleArray(bank.medium).slice(0, mediumCount));
  questions.push(...shuffleArray(bank.hard).slice(0, hardCount));

  return questions;
};

export const getFollowUpQuestion = async (topic, currentQuestion, candidateAnswer) => {
  if (!candidateAnswer || candidateAnswer.trim().length < 20) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `You are a ${topic} interviewer. Based on this answer, decide if follow-up is needed. If yes, ask ONE follow-up. If no or excellent, say "NO_FOLLOWUP". Output only the follow-up question or "NO_FOLLOWUP".

Current Question: "${currentQuestion}"
Candidate's Answer: "${candidateAnswer}"`
      }]
    });

    const result = response.choices[0].message.content?.trim() || '';

    if (result === 'NO_FOLLOWUP') {
      return null;
    }

    return result;
  } catch (error) {
    console.error('Follow-up error:', error);
    return null;
  }
};

// Detect filler sounds (mmm, hhhh, umm, err, aaaa)
function hasTooMuchFillerSounds(answer) {
  const fillerPattern = /\b(mmm|hmmm|hmm|hhh|umm|um|err|uh|ahh|aaah|aaa|uhh|uhhh|eem|eee|ohh|ooo)\b/gi;
  const answerWords = answer.trim().split(/\s+/).length;
  const fillerMatches = (answer.match(fillerPattern) || []).length;
  
  return fillerMatches > 5 || (answerWords > 0 && fillerMatches / answerWords > 0.5);
}

export const getFeedback = async (questions, answers, topic) => {
  console.log('🔍 Getting feedback for:', { topicCount: questions.length, answersCount: answers.length });
  
  const safeAnswers = answers && answers.length ? answers : questions.map(() => ({ ans: 'No answer given' }));

  try {
    const prompt = `You are a VERY STRICT ${topic} technical interviewer rating candidate's answers. Be HARSH - do NOT give high marks easily.

STRICT SCORING RULES (NON-NEGOTIABLE):
- "don't know", blank, or "no idea" = 0/10 (ALWAYS)
- One word or 1-5 words only = 1-2/10 (too brief, no explanation)
- 6-15 words, vague/incomplete = 2-3/10 (missing key details)
- 16-30 words, missing concepts = 4-5/10 (partial answer, needs more)
- 31-60 words, decent but not detailed = 5-6/10 (good but surface level)
- 61+ words AND covers main concepts = 6-7/10 (solid answer, good depth)
- ONLY if answer is 100+ words AND CLEARLY explains WITH examples/details AND shows strong understanding = 8/10
- ONLY if answer is exceptional, perfectly detailed with real examples and deep knowledge = 9-10/10

FILLER SOUNDS RULE:
- If answer contains excessive filler sounds (mmm, hhhh, umm, err, aaaa) showing struggle = MAX 5/10
- Feedback: "Your answer shows struggle with excessive filler sounds. Study the topic more thoroughly before attempting."

MAXIMUM RULE: 
- No answer gets 7 or above unless it's CLEARLY EXPLAINED with examples
- One-word answers CANNOT get 8, 9, or 10
- Most answers should score 0-6
- Save 8-10 only for exceptional answers showing REAL expertise

FOR EACH QUESTION, output EXACTLY:

Q1: What is Selenium?
Score: 0/10
Feedback: Blank answer. Study what Selenium is, its architecture, and why it's used in automation testing.

Q2: Difference between Selenium 3 and 4?
Score: 5/10
Feedback: Answer shows struggle with excessive filler sounds (mmm, hhh). Study the topic more thoroughly. When ready, explain differences in clear, complete sentences.

Q3: How do you handle waits?
Score: 8/10
Feedback: Excellent! You clearly explained implicit, explicit, and fluent waits with practical examples showing when to use each. Your knowledge is strong - focus on edge cases and custom wait conditions for mastery.

---

NOW RATE THESE STRICTLY:

${questions.map((q, i) => `Q${i + 1}: ${q}`).join('\n\n')}

CANDIDATE ANSWERS:
${safeAnswers.map((a, i) => {
  const ans = a.ans && a.ans.trim() ? a.ans.trim() : 'No answer / Blank';
  const hasFillerSounds = hasTooMuchFillerSounds(ans);
  return `Q${i + 1}: ${ans}${hasFillerSounds ? ' [NOTE: Contains excessive filler sounds]' : ''}`;
}).join('\n\n')}

IMPORTANT: 
- Be STRICT
- Max score 7 for decent answers
- Only give 8+ for EXCEPTIONAL, clearly explained answers with examples
- If answer has excessive filler sounds, max score is 5
- Output scores between lines, no extra text
- After all Q ratings, add this exact line:
AVERAGE SCORE: X.X/10

PROVIDE FEEDBACK NOW:`;

    console.log('📤 Sending to OpenAI (STRICT mode with filler detection)...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2500
    });

    let feedback = response.choices[0].message.content?.trim();
    console.log('✅ Feedback received');

    if (!feedback || feedback.length < 50) {
      console.warn('⚠️ Feedback too short');
      return generateStrictDefaultFeedback(questions, safeAnswers);
    }

    if (!feedback.includes('AVERAGE SCORE')) {
      const scores = extractScores(feedback);
      if (scores.length > 0) {
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        feedback += `\n\nAVERAGE SCORE: ${avg}/10`;
      }
    }

    return feedback;
  } catch (error) {
    console.error('❌ Feedback error:', error.message);
    return generateStrictDefaultFeedback(questions, safeAnswers);
  }
};

function extractScores(text) {
  const scorePattern = /Score: (\d+)\/10/g;
  const scores = [];
  let match;
  while ((match = scorePattern.exec(text)) !== null) {
    scores.push(parseInt(match[1]));
  }
  return scores;
}

function generateStrictDefaultFeedback(questions, answers) {
  let feedback = '';
  let totalScore = 0;
  
  questions.forEach((q, i) => {
    const answer = answers[i]?.ans || '';
    const answerLength = answer.trim().length;
    const answerLower = answer.toLowerCase();
    let score = 0;
    
    const hasFillerSounds = hasTooMuchFillerSounds(answer);
    
    if (answerLower.includes('don\'t know') || answerLower.includes('no idea') || answerLength === 0) {
      score = 0;
    } else if (hasFillerSounds) {
      score = Math.min(5, Math.max(2, Math.ceil(answerLength / 30)));
    } else if (answerLength <= 5) {
      score = 1;
    } else if (answerLength <= 15) {
      score = 2;
    } else if (answerLength <= 30) {
      score = 4;
    } else if (answerLength <= 60) {
      score = 5;
    } else if (answerLength <= 100) {
      score = 6;
    } else {
      score = 7;
    }
    
    totalScore += score;
    feedback += `Q${i + 1}: ${q}\nScore: ${score}/10\nFeedback: `;
    
    if (score === 0) {
      feedback += `No answer provided. You must study this concept thoroughly.\n\n`;
    } else if (hasFillerSounds) {
      feedback += `Your answer shows struggle with excessive filler sounds. Study this topic more thoroughly before attempting.\n\n`;
    } else if (score <= 2) {
      feedback += `Your answer is far too brief. Provide detailed explanation with examples and context.\n\n`;
    } else if (score <= 4) {
      feedback += `Incomplete answer. You're missing important concepts and details. Study this topic more carefully.\n\n`;
    } else if (score <= 6) {
      feedback += `Decent answer with basic understanding. Add more depth, real examples, and demonstrate stronger knowledge.\n\n`;
    } else {
      feedback += `Good answer showing solid understanding. For excellence, add more technical details and practical examples.\n\n`;
    }
  });
  
const avgScore = (totalScore / questions.length).toFixed(1);
  feedback += `\n\nAVERAGE SCORE: ${avgScore}/10`;
  
  return feedback;
}