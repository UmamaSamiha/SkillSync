import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Portfolio.css';

const API = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

export default function PortfolioPage() {
  const { userId }              = useParams();
  const { user }                = useAuth();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);

  // Edit form state
  const [bio, setBio]               = useState('');
  const [github, setGithub]         = useState('');
  const [linkedin, setLinkedin]     = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills]         = useState([]);

  // Add project form state
  const [showAddProject, setShowAddProject] = useState(false);
  const [projTitle, setProjTitle]           = useState('');
  const [projDesc, setProjDesc]             = useState('');
  const [projRole, setProjRole]             = useState('');
  const [projFeatured, setProjFeatured]     = useState(false);

  const isOwner = user?.id === userId;

  const fetchPortfolio = () => {
    setLoading(true);
    fetch(`${API}/api/portfolio/${userId}`)
      .then(res => res.json())
      .then(res => {
        if (!res.success) throw new Error(res.error);
        setData(res.data);
        setBio(res.data.portfolio?.bio || '');
        setGithub(res.data.portfolio?.github_url || '');
        setLinkedin(res.data.portfolio?.linkedin_url || '');
        setSkills(res.data.portfolio?.skills || []);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPortfolio(); }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API}/api/portfolio/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ bio, github_url: github, linkedin_url: linkedin, skills }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Portfolio updated!');
      setEditing(false);
      fetchPortfolio();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = (e) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleAddProject = async () => {
    if (!projTitle.trim()) return toast.error('Title is required!');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API}/api/portfolio/${userId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: projTitle,
          description: projDesc,
          role: projRole,
          is_featured: projFeatured,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Project added!');
      setShowAddProject(false);
      setProjTitle(''); setProjDesc(''); setProjRole(''); setProjFeatured(false);
      fetchPortfolio();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API}/api/portfolio/${userId}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast.success('Project deleted!');
      fetchPortfolio();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="portfolio-loading">Loading portfolio…</div>;
  if (!data)   return <div className="portfolio-error">Portfolio not found.</div>;

  const { student, portfolio = {}, projects = [], certificates = [] } = data || {};

  return (
    <div className="portfolio-page">

      {/* ── Header ── */}
      <div className="portfolio-header">
        <div className="portfolio-avatar">
          {student.avatar_url
            ? <img src={student.avatar_url} alt="avatar" />
            : student.full_name?.charAt(0).toUpperCase()
          }
        </div>
        <div className="portfolio-header-info">
          <h1 className="portfolio-name">{student.full_name}</h1>
          <div className="portfolio-links">
            {portfolio.github_url && (
              <a href={portfolio.github_url} target="_blank" rel="noreferrer">🔗 GitHub</a>
            )}
            {portfolio.linkedin_url && (
              <a href={portfolio.linkedin_url} target="_blank" rel="noreferrer">💼 LinkedIn</a>
            )}
          </div>
        </div>
        {isOwner && !editing && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            ✏️ Edit Portfolio
          </button>
        )}
      </div>

      {/* ── Edit Form ── */}
      {editing && isOwner && (
        <div className="portfolio-card">
          <h2 className="portfolio-section-title">Edit Portfolio</h2>

          <div className="edit-field">
            <label>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Tell us about yourself..." rows={4} />
          </div>

          <div className="edit-field">
            <label>GitHub URL</label>
            <input value={github} onChange={e => setGithub(e.target.value)}
              placeholder="https://github.com/username" />
          </div>

          <div className="edit-field">
            <label>LinkedIn URL</label>
            <input value={linkedin} onChange={e => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/username" />
          </div>

          <div className="edit-field">
            <label>Skills (press Enter to add)</label>
            <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
              onKeyDown={handleAddSkill} placeholder="e.g. Python, React..." />
            <div className="skills-list" style={{marginTop:'0.5rem'}}>
              {skills.map((skill, i) => (
                <span key={i} className="skill-tag">
                  {skill}
                  <button onClick={() => handleRemoveSkill(skill)}
                    style={{marginLeft:'0.4rem', background:'none', border:'none',
                    color:'inherit', cursor:'pointer'}}>×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="edit-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Bio ── */}
      {!editing && portfolio.bio && (
        <div className="portfolio-card">
          <h2 className="portfolio-section-title">About Me</h2>
          <p className="portfolio-bio">{portfolio.bio}</p>
        </div>
      )}

      {/* ── Skills ── */}
      {!editing && portfolio.skills?.length > 0 && (
        <div className="portfolio-card">
          <h2 className="portfolio-section-title">Skills</h2>
          <div className="skills-list">
            {portfolio.skills.map((skill, i) => (
              <span key={i} className="skill-tag">{skill}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Projects ── */}
      <div className="portfolio-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h2 className="portfolio-section-title" style={{margin:0}}>Projects</h2>
          {isOwner && (
            <button className="btn btn-primary"
              onClick={() => setShowAddProject(!showAddProject)}>
              + Add Project
            </button>
          )}
        </div>

        {/* Add Project Form */}
        {showAddProject && isOwner && (
          <div className="add-project-form">
            <div className="edit-field">
              <label>Title *</label>
              <input value={projTitle} onChange={e => setProjTitle(e.target.value)}
                placeholder="Project title" />
            </div>
            <div className="edit-field">
              <label>Description</label>
              <textarea value={projDesc} onChange={e => setProjDesc(e.target.value)}
                placeholder="What did you build?" rows={3} />
            </div>
            <div className="edit-field">
              <label>Your Role</label>
              <input value={projRole} onChange={e => setProjRole(e.target.value)}
                placeholder="e.g. Frontend Developer" />
            </div>
            <div className="edit-field" style={{flexDirection:'row', alignItems:'center', gap:'0.5rem'}}>
              <input type="checkbox" checked={projFeatured}
                onChange={e => setProjFeatured(e.target.checked)} />
              <label>Featured project</label>
            </div>
            <div className="edit-actions">
              <button className="btn btn-primary" onClick={handleAddProject}>Add Project</button>
              <button className="btn" onClick={() => setShowAddProject(false)}>Cancel</button>
            </div>
          </div>
        )}

        {projects.length === 0 && !showAddProject && (
          <p style={{color:'var(--color-text-muted, #aaa)', marginTop:'1rem'}}>
            No projects yet.
          </p>
        )}

        <div className="projects-grid" style={{marginTop:'1rem'}}>
          {projects.map(proj => (
            <div key={proj.id} className="project-card">
              <div className="project-card-header">
                <h3>
                  {proj.title}
                  {proj.is_featured && <span className="featured-badge">⭐ Featured</span>}
                </h3>
                {isOwner && (
                  <button onClick={() => handleDeleteProject(proj.id)}
                    style={{background:'none', border:'none', color:'#f87171',
                    cursor:'pointer', fontSize:'1.1rem'}}>🗑️</button>
                )}
              </div>
              {proj.description && <p>{proj.description}</p>}
              {proj.role && <span className="project-role">Role: {proj.role}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Certificates ── */}
      {certificates.length > 0 && (
        <div className="portfolio-card">
          <h2 className="portfolio-section-title">Certificates</h2>
          <div className="certs-list">
            {certificates.map(cert => (
              <div key={cert.id} className="cert-card">
                <div className="cert-card-left">
                  <span className="cert-icon">🏆</span>
                </div>
                <div className="cert-card-right">
                  <h3>{cert.title}</h3>
                  <p>
                    {cert.grade && <>Grade: <strong>{cert.grade}</strong> • </>}
                    {new Date(cert.issued_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}