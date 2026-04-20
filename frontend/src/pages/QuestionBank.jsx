import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './QuestionBank.css';

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
const PROJECT_ID = 'aa6f2b36-2cf4-45d4-9352-98b34956dc73';

const TOPICS = [
  { id: '1bf9c985-f652-4b94-a578-6f7f6ecdd416', title: 'Database Systems' },
  { id: '60e6ee28-8a2f-4a22-8e86-4b1254eac55a', title: 'Algorithms' },
  { id: '8dda97d3-ddf7-429d-8130-9482319625fb', title: 'System Design' },
  { id: '64f8c4ed-8b46-4e8e-bb9c-ffe7834eb0c6', title: 'Networks' },
];

export default function QuestionBankPage() {
  const { user }                          = useAuth();
  const [banks, setBanks]                 = useState([]);
  const [selectedBank, setSelectedBank]   = useState(null);
  const [questions, setQuestions]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showAddBank, setShowAddBank]     = useState(false);
  const [showAddQ, setShowAddQ]           = useState(false);

  const [bankTitle, setBankTitle]   = useState('');
  const [bankDesc, setBankDesc]     = useState('');

  const [qText, setQText]           = useState('');
  const [qType, setQType]           = useState('mcq');
  const [qDiff, setQDiff]           = useState('beginner');
  const [qOptions, setQOptions]     = useState(['', '', '', '']);
  const [qAnswer, setQAnswer]       = useState('');
  const [qPoints, setQPoints]       = useState(1);
  const [qTopicId, setQTopicId]     = useState('');

  const token = localStorage.getItem('access_token');
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  const fetchBanks = () => {
    setLoading(true);
    fetch(`${API}/api/question-bank/banks?project_id=${PROJECT_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => setBanks(res.items || []))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  const fetchQuestions = (bankId) => {
    fetch(`${API}/api/question-bank/questions?bank_id=${bankId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => setQuestions(res.items || []))
      .catch(err => toast.error(err.message));
  };

  useEffect(() => { fetchBanks(); }, []);

  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    fetchQuestions(bank.id);
  };

  const handleAddBank = async () => {
    if (!bankTitle.trim()) return toast.error('Title is required!');
    try {
      const res = await fetch(`${API}/api/question-bank/banks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: bankTitle,
          description: bankDesc,
          project_id: PROJECT_ID,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Question bank created!');
      setShowAddBank(false);
      setBankTitle(''); setBankDesc('');
      fetchBanks();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddQuestion = async () => {
    if (!qText.trim()) return toast.error('Question text is required!');
    if (!qTopicId) return toast.error('Please select a topic!');
    try {
      const res = await fetch(`${API}/api/question-bank/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_id:        selectedBank.id,
          topic_id:       qTopicId,
          text:           qText,
          question_type:  qType,
          difficulty:     qDiff,
          options:        qType === 'mcq' ? qOptions.filter(o => o.trim()) : [],
          correct_answer: qType === 'true_false'
            ? (qAnswer.toLowerCase() === 'true')
            : qAnswer,
          points: qPoints,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success('Question added!');
      setShowAddQ(false);
      setQText(''); setQAnswer(''); setQOptions(['', '', '', '']); setQTopicId('');
      fetchQuestions(selectedBank.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="qb-empty">Loading question banks…</div>;

  return (
    <div className="qb-page">

      <div className="qb-header">
        <h1>📚 Question Bank</h1>
        {isTeacherOrAdmin && (
          <button className="btn btn-primary"
            onClick={() => setShowAddBank(!showAddBank)}>
            + New Bank
          </button>
        )}
      </div>

      {showAddBank && (
        <div className="qb-card">
          <h2 className="qb-section-title">Create Question Bank</h2>
          <div className="qb-form">
            <div className="qb-field">
              <label>Title *</label>
              <input value={bankTitle} onChange={e => setBankTitle(e.target.value)}
                placeholder="e.g. Midterm Question Bank" />
            </div>
            <div className="qb-field">
              <label>Description</label>
              <textarea value={bankDesc} onChange={e => setBankDesc(e.target.value)}
                placeholder="What is this bank for?" rows={3} />
            </div>
            <div className="qb-actions">
              <button className="btn btn-primary" onClick={handleAddBank}>Create</button>
              <button className="btn" onClick={() => setShowAddBank(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="qb-card">
        <h2 className="qb-section-title">Question Banks</h2>
        {banks.length === 0 && <div className="qb-empty">No question banks yet.</div>}
        {banks.map(bank => (
          <div key={bank.id} className="qb-bank-card"
            onClick={() => handleSelectBank(bank)}
            style={{borderColor: selectedBank?.id === bank.id ? 'var(--color-primary, #7c3aed)' : ''}}>
            <h3>{bank.title}</h3>
            {bank.description && <p>{bank.description}</p>}
            <p style={{marginTop:'0.5rem'}}>
              Total Questions: <strong>{bank.total_questions}</strong>
            </p>
          </div>
        ))}
      </div>

      {selectedBank && (
        <div className="qb-card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 className="qb-section-title" style={{margin:0}}>
              Questions — {selectedBank.title}
            </h2>
            {isTeacherOrAdmin && (
              <button className="btn btn-primary"
                onClick={() => setShowAddQ(!showAddQ)}>
                + Add Question
              </button>
            )}
          </div>

          {showAddQ && (
            <div className="qb-form">
              <div className="qb-field">
                <label>Question Text *</label>
                <textarea value={qText} onChange={e => setQText(e.target.value)}
                  placeholder="Enter your question here..." rows={3} />
              </div>
              <div className="qb-field">
                <label>Topic *</label>
                <select value={qTopicId} onChange={e => setQTopicId(e.target.value)}>
                  <option value="">-- Select a topic --</option>
                  {TOPICS.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div className="qb-field">
                <label>Type</label>
                <select value={qType} onChange={e => setQType(e.target.value)}>
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                </select>
              </div>
              <div className="qb-field">
                <label>Difficulty</label>
                <select value={qDiff} onChange={e => setQDiff(e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              {qType === 'mcq' && (
                <div className="qb-field">
                  <label>Options</label>
                  {qOptions.map((opt, i) => (
                    <input key={i} value={opt}
                      onChange={e => {
                        const updated = [...qOptions];
                        updated[i] = e.target.value;
                        setQOptions(updated);
                      }}
                      placeholder={`Option ${i + 1}`}
                      style={{marginBottom:'0.4rem'}} />
                  ))}
                </div>
              )}
              <div className="qb-field">
                <label>
                  {qType === 'true_false'
                    ? 'Correct Answer (select)'
                    : 'Correct Answer'}
                </label>
                {qType === 'true_false'
                  ? (
                    <select value={qAnswer} onChange={e => setQAnswer(e.target.value)}>
                      <option value="">-- Select --</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <input value={qAnswer} onChange={e => setQAnswer(e.target.value)}
                      placeholder="Correct answer" />
                  )
                }
              </div>
              <div className="qb-field">
                <label>Points</label>
                <input type="number" value={qPoints}
                  onChange={e => setQPoints(Number(e.target.value))} min={1} />
              </div>
              <div className="qb-actions">
                <button className="btn btn-primary" onClick={handleAddQuestion}>
                  Add Question
                </button>
                <button className="btn" onClick={() => setShowAddQ(false)}>Cancel</button>
              </div>
            </div>
          )}

          {questions.length === 0 && !showAddQ && (
            <div className="qb-empty" style={{marginTop:'1rem'}}>
              No questions yet.
            </div>
          )}
          <div style={{marginTop:'1rem'}}>
            {questions.map((q, i) => (
              <div key={q.id} className="qb-question-card">
                <div className="qb-question-meta">
                  <span className={`qb-badge qb-badge-${q.difficulty}`}>
                    {q.difficulty}
                  </span>
                  <span className="qb-badge" style={{
                    background:'#7c3aed22', color:'#a78bfa',
                    border:'1px solid #7c3aed55'}}>
                    {q.question_type}
                  </span>
                  <span style={{color:'var(--color-text-muted,#aaa)',fontSize:'0.8rem'}}>
                    {q.points} pt{q.points > 1 ? 's' : ''}
                  </span>
                  {q.topic && (
                    <span style={{color:'var(--color-text-muted,#aaa)',fontSize:'0.8rem'}}>
                      📖 {q.topic.title}
                    </span>
                  )}
                </div>
                <h3>{i + 1}. {q.text}</h3>
                {q.options?.length > 0 && (
                  <ul className="qb-options">
                    {q.options.map((opt, j) => (
                      <li key={j} className={opt === q.correct_answer ? 'correct' : ''}>
                        {opt === q.correct_answer ? '✅' : '○'} {opt}
                      </li>
                    ))}
                  </ul>
                )}
                {q.question_type === 'true_false' && (
                  <p style={{color:'#4ade80', fontSize:'0.85rem', marginTop:'0.5rem'}}>
                    ✅ Answer: {q.correct_answer ? 'True' : 'False'}
                  </p>
                )}
                {q.question_type === 'short_answer' && (
                  <p style={{color:'#4ade80', fontSize:'0.85rem', marginTop:'0.5rem'}}>
                    ✅ Answer: {q.correct_answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}