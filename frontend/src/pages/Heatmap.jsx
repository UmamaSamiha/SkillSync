import { useState, useEffect } from "react";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const HEAT_COLORS = ["#EAEAD8", "#D4D994", "#A8AF4A", "#5E6623", "#3D4316"];
const CONTRIB_COLORS = ["#893941", "#CB7885", "#D4D994", "#5E6623", "#7A5C8A"];

function getHeatColor(count) {
  if (count === 0) return HEAT_COLORS[0];
  if (count <= 2)  return HEAT_COLORS[1];
  if (count <= 5)  return HEAT_COLORS[2];
  if (count <= 10) return HEAT_COLORS[3];
  return HEAT_COLORS[4];
}

export default function HeatmapPage() {
  const { user } = useAuth();

  const [projectId,         setProjectId]         = useState(null);
  const [dateCols,          setDateCols]          = useState([]);
  const [members,           setMembers]           = useState([]);
  const [contributionShare, setContributionShare] = useState([]);
  const [stats,             setStats]             = useState(null);
  const [inactiveMembers,   setInactiveMembers]   = useState([]);
  const [days,              setDays]              = useState(7);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);
  const [notifying,         setNotifying]         = useState(false);

  // Step 1: get the user's project — User model has no project_id field,
  // it's linked through ProjectMember, so we use /api/users/<id>/projects
  useEffect(() => {
    if (!user?.id) return;
    api.get(`/users/${user.id}/projects`)
      .then(res => {
        const projects = res.data.data;
        if (projects && projects.length > 0) {
          setProjectId(projects[0].id);
        } else {
          setError("You are not assigned to any project yet.");
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Could not load your project. Is the backend running?");
        setLoading(false);
      });
  }, [user?.id]);

  // Step 2: once we have projectId, load the heatmap
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    api.get(`/heatmap/${projectId}?days=${days}`)
      .then(res => {
        const d = res.data.data;
        setDateCols(d.date_cols || []);
        setMembers(d.members || []);
        setContributionShare(d.contribution_share || []);
        setStats(d.stats || null);
        setInactiveMembers(d.inactive_members || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load heatmap data.");
        setLoading(false);
      });
  }, [projectId, days]);

  const handleNotifyAll = async () => {
    setNotifying(true);
    try {
      await api.post(`/heatmap/${projectId}/notify-inactive`);
      alert(`Reminders sent to ${inactiveMembers.length} inactive member(s)!`);
    } catch {
      alert("Failed to send notifications.");
    } finally {
      setNotifying(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, color: "#7A7063" }}>Loading heatmap…</div>
  );
  if (error) return (
    <div style={{ padding: 40, color: "#893941" }}>{error}</div>
  );

  return (
    <div>
      <h2 style={{ marginBottom: 4, fontFamily: "'Playfair Display',serif" }}>
        Team Collaboration Heatmap
      </h2>
      <p style={{ color: "#7A7063", fontSize: "0.88rem", marginBottom: 12 }}>
        Visual activity breakdown for your project group
      </p>

      {/* Days filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: "5px 14px", borderRadius: 999, fontSize: "0.82rem",
            background: days === d ? "#893941" : "rgba(45,45,45,0.08)",
            color: days === d ? "#fff" : "#3D3D3A",
            border: "none", cursor: "pointer",
          }}>
            Last {d} Days
          </button>
        ))}
      </div>

      {/* Inactive alert */}
      {inactiveMembers.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FDE8EA", border: "1px solid #CB7885",
          borderRadius: 10, padding: "10px 16px", marginBottom: 20, flexWrap: "wrap", gap: 8,
        }}>
          <span style={{ fontSize: "0.85rem", color: "#893941", fontWeight: 500 }}>
            🔔 {inactiveMembers.length} member{inactiveMembers.length > 1 ? "s have" : " has"} been inactive for 5+ days
          </span>
          <button onClick={handleNotifyAll} disabled={notifying} style={{
            background: "#893941", color: "#fff", border: "none",
            borderRadius: 999, padding: "6px 14px", fontSize: "0.8rem",
            cursor: notifying ? "not-allowed" : "pointer", opacity: notifying ? 0.6 : 1,
          }}>
            {notifying ? "Sending…" : "Notify All"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* Activity Grid */}
        <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7A7063", marginBottom: 16 }}>
            Activity Grid
          </p>
          <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${dateCols.length}, 1fr)`, gap: 6, overflowX: "auto" }}>
            <div />
            {dateCols.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "#7A7063" }}>
                {/* Backend sends ISO dates e.g. "2026-04-11" — show short weekday name */}
                {new Date(d + "T12:00:00").toLocaleDateString("en", { weekday: "short" })}
              </div>
            ))}
            {members.map(m => (
              <div key={m.user.id} style={{ display: "contents" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 500, display: "flex", alignItems: "center" }}>
                  {m.user.full_name.split(" ")[0]}
                </div>
                {dateCols.map((d, i) => (
                  <div key={i} style={{
                    aspectRatio: "1", borderRadius: 6,
                    background: getHeatColor(m.activity[d] || 0),
                    cursor: "pointer",
                  }} title={`${m.user.full_name} · ${d}: ${m.activity[d] || 0} actions`} />
                ))}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.75rem", color: "#7A7063" }}>Legend:</span>
            {[["#EAEAD8","None"],["#D4D994","Low"],["#A8AF4A","Med"],["#5E6623","High"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
                <span style={{ fontSize: "0.75rem", color: "#7A7063" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contribution Share */}
        <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: "0.78rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#7A7063", marginBottom: 16 }}>
            Contribution Share
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {contributionShare.map((m, i) => (
              <div key={m.user.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: CONTRIB_COLORS[i % CONTRIB_COLORS.length],
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "0.75rem", fontWeight: 600, flexShrink: 0,
                }}>
                  {getInitials(m.user.full_name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{m.user.full_name}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#893941" }}>{m.percentage}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(45,45,45,0.1)", borderRadius: 999, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#893941,#CB7885)", width: `${m.percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 20 }}>
          {[
            { icon: "👥", value: `${stats.active_members}/${stats.total_members}`, label: "Active Members" },
            { icon: "⚡", value: stats.total_actions,   label: "Total Actions" },
            { icon: "📅", value: stats.most_active_day, label: "Most Active Day" },
          ].map((s, i) => (
            <div key={i} style={{
              background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)",
              borderRadius: 16, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(137,57,65,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "0.8rem", color: "#7A7063", marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}