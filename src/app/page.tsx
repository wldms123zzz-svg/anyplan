"use client";
import { useState, useEffect, useRef } from "react";

// 취향 태그 풀
const TAGS = {
  무드: ["로맨틱한", "신나는", "차분한", "웃음가득", "힐링되는", "이색적인"],
  활동: ["먹기", "걷기", "보기", "만들기", "배우기", "놀기", "문화/축제", "역사 탐방 🏛️", "음악/공연 🎵"],
  몸상태: ["완전 쌩쌩함 🏃", "적당함 🚶", "조금 피곤함 🥱", "녹초 상태 🫠"],
  예산: ["공짜면 좋지 💸", "오늘만큼은 돈을 쓸래요! 💳"],
  지역: ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
  이동수단: ["뚜벅이 데이트 🚶‍♀️", "자차 데이트 🚗"],
};

export default function DateThemeApp() {
  const [step, setStep] = useState("start");
  const [profile, setProfile] = useState({ myAge: 25, myGender: "여", partnerAge: 25, partnerGender: "남" });
  const [taste, setTaste] = useState<{ 무드: string[]; 활동: string[] }>({ 무드: [], 활동: [] });
  const [condition, setCondition] = useState<{
    myBody: string;
    partnerBody: string;
    예산: string;
    지역: string;
    mode: string;
    이동수단: string;
  }>({ myBody: "", partnerBody: "", 예산: "", 지역: "전국", mode: "", 이동수단: "" });
  const [result, setResult] = useState<{
    theme: string;
    emoji: string;
    desc: string;
    vibe: string;
    doThis: string[];
    transportInfo?: string;
    talkTopic: string;
    randomTwist: string;
    perfectFor: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("AI가 결과 찾는 중...");
  const [rolling, setRolling] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [partnerVote, setPartnerVote] = useState<string | null>(null); 
  const [countdown, setCountdown] = useState(5);
  const [loadingTip, setLoadingTextTip] = useState("");
  const [festivals, setFestivals] = useState<{
    title: string;
    addr1?: string;
    firstimage?: string;
    eventstartdate?: string;
    eventenddate?: string;
  }[]>([]);
  const [showFestivals, setShowFestivals] = useState(false);
  const [festLoading, setFestLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [festMessage, setFestMessage] = useState("");
  const diceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedMonth(new Date().getMonth() + 1);
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get("data");
    if (sharedData) {
      try {
        const decodedData = decodeURIComponent(sharedData);
        const parsed = JSON.parse(decodedData);
        setResult(parsed);
        setStep("result");
      } catch (e) {
        console.error("공유 데이터 파싱 실패", e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).toss?.ad?.showBanner) {
      (window as any).toss.ad.showBanner({
        adGroupId: "ait.v2.live.0cdc8d469958499a",
        container: "#toss-ad-container",
      });
    }
  }, [step, loading]);

  useEffect(() => {
    let interval: any;
    let tipInterval: any;
    let timer: any;

    if (loading) {
      setCountdown(5);
      const messages = ["📡 전국 데이터 네트워크 접속 중...", "🧠 완벽한 동선 설계 중...", "✨ 분위기 좋은 장소 찾는 중...", "💡 특별한 대화 주제 고르는 중..."];
      const tips = ["💡 팁: 가끔은 지도 없이 우연히 마주친 작은 골목길이 더 짙은 기억으로 남기도 해요.", "💡 팁: 소중한 사람의 찰나를 기록할 땐 수평을 맞춰보세요.", "💡 팁: 지금 눈앞에 보이는 가장 예쁜 것에 대해 이야기해보세요."];
      let i = 0, j = 0;
      setLoadingText(messages[0]);
      setLoadingTextTip(tips[0]);
      interval = setInterval(() => { i = (i + 1) % messages.length; setLoadingText(messages[i]); }, 1500);
      tipInterval = setInterval(() => { j = (j + 1) % tips.length; setLoadingTextTip(tips[j]); }, 2500);
      timer = setInterval(() => { setCountdown((prev) => (prev > 1 ? prev - 1 : 1)); }, 1000);
    }
    return () => { clearInterval(interval); clearInterval(tipInterval); clearInterval(timer); };
  }, [loading]);

  const triggerHaptic = (type = "light") => {
    if (typeof window !== "undefined" && (window as any).toss?.haptic) {
      (window as any).toss.haptic(type);
    }
  };

  const toggle = (cat: string, val: string) => {
    triggerHaptic("light");
    setTaste((p: any) => ({ ...p, [cat]: p[cat].includes(val) ? p[cat].filter((v: string) => v !== val) : [...p[cat], val] }));
  };

  const setCond = (key: string, val: string) => {
    triggerHaptic("light");
    setCondition((p: any) => ({ ...p, [key]: val }));
  };

  const reset = () => {
    triggerHaptic(); setStep("start"); setTaste({ 무드: [], 활동: [] }); setCondition({ myBody: "", partnerBody: "", 예산: "", 지역: "전국", mode: "", 이동수단: "" }); setResult(null); setErrorMsg("");
  };

  const fetchFestivals = async (month?: number) => {
    if (festLoading) return;
    const targetMonth = month || selectedMonth;
    if (month) setSelectedMonth(month);
    triggerHaptic(); setFestLoading(true); setShowFestivals(true); setFestMessage("");
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_BASE_URL}/api/festivals?t=${Date.now()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: condition.지역, month: targetMonth }),
      });
      const data = await res.json();
      if (data.error || data.message) { setFestMessage(data.error || data.message); setFestivals([]); }
      else { setFestivals(Array.isArray(data) ? data : []); }
    } catch (err) { setFestMessage("오류가 발생했습니다."); setFestivals([]); }
    finally { setFestLoading(false); }
  };

  const rollTheme = async () => {
    if (loading) return;
    triggerHaptic(); setLoading(true); setErrorMsg("");
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${API_BASE_URL}/api/theme?t=${Date.now()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, taste, condition }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "API Error");
      setResult(data); setStep("result");
    } catch (err: any) { setErrorMsg(`추천 실패: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleShare = async () => {
    if (isSharing || !result) return;
    setIsSharing(true); triggerHaptic("light");
    const encodedData = encodeURIComponent(JSON.stringify(result));
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
    const shareText = `[오늘의 조각 🧩]\n${result.theme}\n${shareUrl}`;
    try {
      if (typeof window !== "undefined" && (window as any).toss?.share) { await (window as any).toss.share({ text: shareText }); }
      else if (navigator.share) { await navigator.share({ title: "데이트 추천", text: shareText, url: shareUrl }); }
      else { await navigator.clipboard.writeText(shareText); alert("복사되었습니다!"); }
    } catch (err) {} finally { setTimeout(() => setIsSharing(false), 500); }
  };

  const handleVote = (vote: string) => {
    triggerHaptic(vote === "agree" ? "success" : "light"); setPartnerVote(vote);
    const voteText = vote === "agree" ? "👍 이 데이트 찬성!" : "👎 다른 거 뽑자!";
    if (confirm("결과를 공유할까요?")) {
      if (typeof window !== "undefined" && (window as any).toss?.share) { (window as any).toss.share({ text: voteText }); }
      else if (navigator.share) { navigator.share({ text: voteText }); }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F6", color: "#191F28", fontFamily: "Pretendard, -apple-system, sans-serif", paddingBottom: "100px" }}>
      <style jsx global>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rolling { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .fade-up { animation: fadeUp 0.4s ease-out forwards; }
        .rolling { animation: rolling 2s infinite linear; display: inline-block; }
        .tag-btn { padding: 12px 16px; border-radius: 12px; border: none; background: #FFF; color: #4E5968; font-size: 15px; cursor: pointer; transition: all 0.2s; }
        .tag-btn.active { background: #E8F3FF; color: #3182F6; font-weight: 600; }
        .roll-btn { width: 100%; padding: 18px; border-radius: 16px; border: none; background: #3182F6; color: #FFF; font-size: 17px; font-weight: 600; cursor: pointer; }
        .roll-btn:disabled { background: #D1D6DB; }
      `}</style>

      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.9)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 24 }} className="rolling">🎲</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{loadingText}</h2>
          <p style={{ color: "#4E5968", marginBottom: 32 }}>약 {countdown}초만 기다려주세요!</p>
          <div style={{ padding: "16px 20px", background: "#F9FAFB", borderRadius: "12px", border: "1px solid #F2F4F6", maxWidth: 320 }}>{loadingTip}</div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ paddingTop: 56, paddingBottom: 24 }}>
          {step === "start" ? (
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3 }}>누군가와 함께하는 오늘,<br />어떤 풍경을 담고 싶나요? ✨</h1>
          ) : step !== "result" ? (
            <div style={{ display: "flex", gap: 6 }}>
              {["profile", "taste", "condition"].map((s, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: step === s ? "#3182F6" : "#D1D6DB" }} />
              ))}
            </div>
          ) : null}
        </div>

        {errorMsg && <div style={{ background: "#FEE2E2", color: "#EF4444", padding: "16px", borderRadius: "12px", marginBottom: 20 }}>{errorMsg}</div>}

        {step === "start" && (
          <div className="fade-up">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 48 }}>
              {["✨ 함께 채워갈 이야기", "📅 다가올 설렘", "🎨 맞춤형 큐레이션"].map((t, i) => (
                <div key={i} style={{ background: "#FFF", padding: 20, borderRadius: 16 }}>{t}</div>
              ))}
            </div>
            <button className="roll-btn" onClick={() => setStep("profile")}>시작하기</button>
          </div>
        )}

        {step === "profile" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>누구와 함께 가나요?</h2>
            <div style={{ background: "#FFF", padding: 24, borderRadius: 16, marginBottom: 20 }}>
              <p style={{ fontWeight: 700, marginBottom: 16 }}>😎 나의 나이</p>
              <input type="number" value={profile.myAge} onChange={e => setProfile({...profile, myAge: parseInt(e.target.value) || 0})} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #EEE" }} />
            </div>
            <div style={{ background: "#FFF", padding: 24, borderRadius: 16, marginBottom: 32 }}>
              <p style={{ fontWeight: 700, marginBottom: 16 }}>🧑‍🤝‍🧑 동행인 나이</p>
              <input type="number" value={profile.partnerAge} onChange={e => setProfile({...profile, partnerAge: parseInt(e.target.value) || 0})} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #EEE" }} />
            </div>
            <button className="roll-btn" onClick={() => setStep("taste")}>다음</button>
          </div>
        )}

        {step === "taste" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>우리의 무드와 활동</h2>
            {["무드", "활동"].map((cat: any) => (
              <div key={cat} style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>{cat}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {TAGS[cat as keyof typeof TAGS].map((v: string) => (
                    <button key={v} className={`tag-btn ${taste[cat as "무드" | "활동"].includes(v) ? "active" : ""}`} onClick={() => toggle(cat, v)}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
            <button className="roll-btn" onClick={() => setStep("condition")}>다음</button>
          </div>
        )}

        {step === "condition" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>장소 및 예산</h2>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", margin: 0 }}>지역</p>
                {condition.지역 && condition.지역 !== "전국" && (
                  <button 
                    onClick={() => fetchFestivals()}
                    style={{ fontSize: 12, padding: "6px 12px", borderRadius: "8px", border: "none", background: "#E8F3FF", color: "#3182F6", fontWeight: 600, cursor: "pointer" }}
                  >
                    🎭 {condition.지역} 축제 보기
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TAGS.지역.map(v => (
                  <button key={v} className={`tag-btn ${condition.지역 === v ? "active" : ""}`} onClick={() => setCond("지역", v)}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>예산</p>
              {TAGS.예산.map(v => (
                <button key={v} className={`tag-btn ${condition.예산 === v ? "active" : ""}`} style={{ width: "100%", marginBottom: 8 }} onClick={() => setCond("예산", v)}>{v}</button>
              ))}
            </div>
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>이동 수단</p>
              <div style={{ display: "flex", gap: 8 }}>
                {TAGS.이동수단.map(v => (
                  <button key={v} className={`tag-btn ${condition.이동수단 === v ? "active" : ""}`} style={{ flex: 1 }} onClick={() => setCond("이동수단", v)}>{v}</button>
                ))}
              </div>
            </div>
            <button className="roll-btn" disabled={!condition.지역 || !condition.예산} onClick={rollTheme}>테마 뽑기</button>
          </div>
        )}

        {step === "result" && result && (
          <div className="fade-up">
            <div style={{ background: "#FFF", borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", marginBottom: 20 }}>
              <div style={{ padding: 32, background: "#F9FAFB" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>{result.emoji}</div>
                <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>{result.theme}</h2>
                <p style={{ color: "#4E5968", lineHeight: 1.6, marginBottom: 16 }}>{result.desc}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {result.vibe.map(v => <span key={v} style={{ color: "#3182F6", fontWeight: 600 }}>{v}</span>)}
                </div>
              </div>
              <div style={{ padding: 24 }}>
                {result.transportInfo && (
                  <div style={{ background: "#F2F4F6", padding: "16px 20px", borderRadius: "16px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid #E5E8EB" }}>
                    <span style={{ fontSize: 20 }}>{condition.이동수단?.includes("자차") ? "🚗" : "🚌"}</span>
                    <p style={{ fontSize: 14, color: "#4E5968", fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{result.transportInfo}</p>
                  </div>
                )}
                <p style={{ fontSize: 13, fontWeight: 600, color: "#8B95A1", marginBottom: 16 }}>코스 안내</p>
                {result.doThis.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <span style={{ color: "#3182F6", fontWeight: 800 }}>{i + 1}</span>
                    <span style={{ color: "#333D4B" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="roll-btn" style={{ background: "#E5E8EB", color: "#4E5968" }} onClick={reset}>처음으로</button>
              <button className="roll-btn" onClick={rollTheme}>다시 뽑기</button>
            </div>
          </div>
        )}

        {/* 하단 광고 영역 */}
        <div id="toss-ad-container" style={{ width: "100%", minHeight: "100px", marginTop: "40px", borderRadius: "16px", overflow: "hidden" }}></div>
      </div>

      {showFestivals && (
        <div style={{ 
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
          background: "rgba(0,0,0,0.5)", zIndex: 10000, 
          display: "flex", alignItems: "flex-end", justifyContent: "center"
        }} onClick={() => setShowFestivals(false)}>
          <div 
            style={{ 
              width: "100%", maxWidth: 480, background: "#FFFFFF", 
              borderTopLeftRadius: 24, borderTopRightRadius: 24, 
              padding: "32px 24px", minHeight: "60vh", maxHeight: "85vh", 
              overflowY: "auto", animation: "slideUp 0.3s ease-out" 
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: "#191F28", margin: 0 }}>
                {condition.지역} 다가오는 축제 🎭
              </h3>
              <button 
                onClick={() => setShowFestivals(false)}
                style={{ background: "none", border: "none", fontSize: 24, color: "#8B95A1", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: "flex", overflowX: "auto", gap: 12, marginBottom: 24, paddingBottom: 8, msOverflowStyle: "none", scrollbarWidth: "none" }} className="hide-scrollbar">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <button
                  key={m}
                  onClick={() => fetchFestivals(m)}
                  style={{
                    flex: "0 0 auto", padding: "8px 16px", borderRadius: "12px", border: "none",
                    background: selectedMonth === m ? "#3182F6" : "#F2F4F6",
                    color: selectedMonth === m ? "#FFFFFF" : "#4E5968",
                    fontWeight: 600, fontSize: 14, cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  {m}월
                </button>
              ))}
            </div>
            
            {festMessage ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#8B95A1", lineHeight: 1.6 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🗺️</div>
                {festMessage}
              </div>
            ) : festLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div className="rolling" style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
                <p style={{ color: "#8B95A1" }}>데이터를 불러오는 중...</p>
              </div>
            ) : festivals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {festivals.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 16, background: "#F9FAFB", padding: "16px", borderRadius: "16px" }}>
                    {f.firstimage ? (
                      <img src={f.firstimage} alt={f.title} style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 12, background: "#E5E8EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎪</div>
                    )}
                    <div style={{ flex: 1 }}>
                      {f.eventstartdate && (
                        <div style={{ fontSize: 13, color: "#3182F6", fontWeight: 600, marginBottom: 4 }}>
                          {f.eventstartdate.slice(4,6)}.{f.eventstartdate.slice(6,8)} ~ {f.eventenddate?.slice(4,6)}.{f.eventenddate?.slice(6,8)}
                        </div>
                      )}
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#191F28", marginBottom: 4 }}>{f.title}</div>
                      <div style={{ fontSize: 13, color: "#8B95A1" }}>{f.addr1 || "지역 정보 없음"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#8B95A1" }}>
                아쉽게도 {selectedMonth}월엔 예정된 축제가 없습니다. 🥲
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
