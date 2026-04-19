import { useState, useEffect } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import api from "../utils/api";

ChartJS.register(ArcElement, Tooltip, Legend);

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const COLORS = ["#893941", "#CB7885", "#D4D994", "#5E6623"];
const LABELS = ["File Uploads", "Comments", "Forum Posts", "Quiz Attempts"];
const PROGRESS_WIDTH = { Active: "65%", "At Risk": "15%", Inactive: "5%" };

export default function MemberDetailPage() {
  const [members,    setMembers]    = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail,     setDetail]     = useState(null);   // from /api/ai/member-detail/<id>
  const [insight,    setInsight]    = useState("");
  const [toast,      setToast]      = useState("");
  const [loadingList,   setLoadingList]   = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingInsight,setLoadingInsight]= useState(false);

  // ── 1. Fetch student list ──────────────────────────────────────
  useEffect(() => {
    setLoadingList(true);
    api.get("/users?role=student")
      .then(res => {
        const list = res.data?.data || [];
        setMembers(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingList(false));
  }, []);

  // ── 2. Fetch detail for selected member ───────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setDetail(null);
    setInsight("");
    setLoadingDetail(true);
    api.get(`/ai/member-detail/${selectedId}`)
      .then(res => setDetail(res.data?.data || null))
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const selectedMember = members.find(m => m.id === selectedId);

  // ── 3. Get AI insight ─────────────────────────────────────────
  const handleInsight = async () => {
    if (!selectedMember || !detail) return;
    setLoadingInsight(true);
    try {
      const res = await api.post("/ai/member-insight", {
        member_data: {
          full_name:    selectedMember.full_name,
          status:       detail.status,
          modules_done: detail.modules_done,
          last_active:  selectedMember.last_active,
          contribution: detail.contribution,
        },
      });
      setInsight(res.data?.data?.insight || "");
    } catch (e) {
      showToast("Could not fetch AI insight");
    } finally {
      setLoadingInsight(false);
    }
  };

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // ── Contribution donut ────────────────────────────────────────
  const contrib = detail?.contribution || { file_upload: 25, comments: 25, forum_posts: 25, quiz_attempts: 25 };
  const donutData = {
    labels: LABELS,
    datasets: [{
      data:            Object.values(contrib),
      backgroundColor: COLORS,
      borderColor:     "#FDFAF7",
      borderWidth:     3,
      hoverOffset:     6,
    }],
  };
  const donutOptions = {
    responsive: true,
    cutout:     "68%",
    plugins: {
      legend:  { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}%` } },
    },
  };

  // ── Render ────────────────────────────────────────────────────
  if (loadingList) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "#7A7063" }}>
        Loading members…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 0, minHeight: "100vh", background: "#F5F0E8", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── LEFT SIDEBAR ────────────────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: "#FDFAF7",
        borderRight: "1px solid rgba(45,45,45,0.1)",
        padding: "20px 0",
      }}>
        <p style={{
          fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "#7A7063",
          padding: "0 18px 12px",
        }}>Project Members</p>

        {members.map(m => {
          const isSelected = m.id === selectedId;
          const status     = m.is_active ? "Active" : "At Risk";
          const isActive   = status === "Active";
          return (
            <div
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 18px", cursor: "pointer",
                background:   isSelected ? "#F5F0E8" : "transparent",
                borderLeft:   isSelected ? "3px solid #893941" : "3px solid transparent",
                transition:   "all 0.15s",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: isActive ? "#5E6623" : "#893941",
                color: "#fff", fontWeight: 700, fontSize: "0.75rem",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {getInitials(m.full_name)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: "0.82rem", fontWeight: 600, color: "#2D2D2D",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100,
                  }}>
                    {m.full_name}
                  </span>
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px",
                    borderRadius: 999, flexShrink: 0, marginLeft: 4,
                    background: isActive ? "#D4D994" : "#F5D0D3",
                    color:      isActive ? "#5E6623" : "#893941",
                  }}>
                    {status}
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#7A7063", marginTop: 1 }}>{m.role}</div>
                <div style={{ height: 3, background: "#E8E0D0", borderRadius: 2, marginTop: 5 }}>
                  <div style={{
                    height: 3, borderRadius: 2,
                    background:  isActive ? "#5E6623" : "#893941",
                    width:       PROGRESS_WIDTH[status] || "30%",
                    transition:  "width 0.3s",
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: 32 }}>

        {/* Profile header */}
        {selectedMember && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 28 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
              background: selectedMember.is_active ? "#5E6623" : "#893941",
              color: "#fff", fontWeight: 700, fontSize: "1.1rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif",
            }}>
              {getInitials(selectedMember.full_name)}
            </div>
            <div>
              <h2 style={{ fontFamily: "'Playfair Display',serif", margin: "0 0 4px", fontSize: "1.6rem" }}>
                {selectedMember.full_name}
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#7A7063", margin: "0 0 8px" }}>
                Last Active:{" "}
                {selectedMember.last_active
                  ? new Date(selectedMember.last_active).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
                  : "Unknown"}
              </p>
              <span style={{
                fontSize: "0.75rem", fontWeight: 600, padding: "3px 10px",
                borderRadius: 999, background: "#E8E0D0", color: "#5A4A38",
              }}>
                {detail?.modules_done ? `Modules: ${detail.modules_done}` : selectedMember.role}
              </span>
            </div>
          </div>
        )}

        {loadingDetail ? (
          <div style={{ textAlign: "center", color: "#7A7063", padding: "40px 0" }}>Loading member data…</div>
        ) : detail && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>

            {/* Contribution card */}
            <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>
              <h4 style={{ fontFamily: "'DM Sans',sans-serif", marginBottom: 20 }}>Contribution Breakdown</h4>

              <div style={{ width: 180, margin: "0 auto 20px" }}>
                <Doughnut data={donutData} options={donutOptions} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {LABELS.map((label, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i] }} />
                      <span style={{ fontSize: "0.82rem", color: "#2D2D2D" }}>{label}</span>
                    </div>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#7A7063" }}>
                      {Object.values(contrib)[i]}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={() => showToast(`Reminder sent to ${selectedMember?.full_name} ✓`)}
                  style={{ padding: "8px 18px", borderRadius: 999, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", background: "transparent", color: "#893941", border: "1.5px solid #893941" }}>
                  Send reminder
                </button>
                <button
                  onClick={() => showToast(`${selectedMember?.full_name} flagged as inactive`)}
                  style={{ padding: "8px 18px", borderRadius: 999, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", background: "transparent", color: "#7A7063", border: "1.5px solid rgba(45,45,45,0.2)" }}>
                  Flag as Inactive
                </button>
                <button
                  onClick={handleInsight}
                  disabled={loadingInsight}
                  style={{ padding: "8px 18px", borderRadius: 999, fontSize: "0.875rem", fontWeight: 500, cursor: loadingInsight ? "not-allowed" : "pointer", background: "#893941", color: "#fff", border: "none", opacity: loadingInsight ? 0.65 : 1 }}>
                  {loadingInsight ? "Thinking…" : "AI Insight"}
                </button>
              </div>

              {/* AI insight block */}
              {insight && (
                <div style={{ marginTop: 16, padding: "12px 14px", background: "#F5F0E8", borderRadius: 10, fontSize: "0.82rem", color: "#2D2D2D", lineHeight: 1.6 }}>
                  {insight}
                </div>
              )}
            </div>

            {/* Recent Activity card */}
            <div style={{ background: "#FDFAF7", border: "1px solid rgba(45,45,45,0.1)", borderRadius: 16, padding: 24 }}>
              <h4 style={{ marginBottom: 20, fontFamily: "'DM Sans',sans-serif" }}>Recent Activity</h4>
              {detail.recent_activity.length === 0 ? (
                <p style={{ color: "#7A7063", fontSize: "0.88rem" }}>No recent activity recorded.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {detail.recent_activity.map((act, i) => (
                    <div key={act.id} style={{ display: "flex", gap: 16, paddingBottom: 20, position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: act.color, flexShrink: 0, marginTop: 4 }} />
                        {i < detail.recent_activity.length - 1 && (
                          <div style={{ width: 2, flex: 1, background: "rgba(45,45,45,0.1)", marginTop: 4 }} />
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: "0.78rem", color: "#7A7063", marginBottom: 4 }}>{act.date}</p>
                        <p style={{ fontSize: "0.88rem", color: "#2D2D2D", fontWeight: 500 }}>{act.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#2D2D2D", color: "#FDFAF7", padding: "10px 22px",
          borderRadius: 8, fontSize: "0.82rem", fontWeight: 500, zIndex: 999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>{toast}</div>
      )}
    </div>
  );
}