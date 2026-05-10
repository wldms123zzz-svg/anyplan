"use client";
import { useState, useEffect, useRef } from "react";
import { BannerAd } from "@/components/BannerAd";

// 취향 태그 풀
const TAGS = {
  무드: ["로맨틱한", "신나는", "차분한", "웃음가득", "힐링되는", "이색적인"],
  활동: ["먹기", "걷기", "보기", "만들기", "배우기", "놀기", "문화/축제", "역사 탐방 🏛️", "음악/공연 🎵"],
  몸상태: ["완전 쌩쌩함 🏃", "적당함 🚶", "조금 피곤함 🥱", "녹초 상태 🫠"],
  예산: ["공짜면 좋지 💸", "오늘만큼은 돈을 쓸래요! 💳"],
  지역: ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
  이동수단: ["뚜벅이 데이트 🚶‍♀️", "자차 데이트 🚗"],
};

// API 프록시 서버 주소 (Vercel 배포 후 해당 URL로 변경 필요)
const BASE_API_URL = "https://anyplan-gamma.vercel.app";

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
        // 안전하게 데이터 디코딩 및 파싱
        const jsonString = decodeURIComponent(sharedData.replace(/\+/g, " "));
        const parsed = JSON.parse(jsonString);
        if (parsed && parsed.theme) {
          setResult(parsed);
          setStep("result");
        }
      } catch (e: any) {
        console.error("공유 데이터 처리 실패:", e);
      }
    }
  }, []);

  // 배너 광고 아이디
  const AD_GROUP_ID = "ait.v2.live.0cdc8d469958499a";

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
    triggerHaptic(); 
    setStep("start"); 
    setTaste({ 무드: [], 활동: [] }); 
    setCondition({ 지역: "전국", 예산: "적당히", 이동수단: "대중교통", 체력: "보통" }); 
    setResult(null); 
    setErrorMsg("");
  };

  const fetchFestivals = async (month?: number) => {
    if (festLoading) return;
    const targetMonth = month || selectedMonth;
    if (month) setSelectedMonth(month);
    triggerHaptic(); setFestLoading(true); setShowFestivals(true); setFestMessage("");
    try {
      const region = condition.지역 === "전국" ? "" : condition.지역;
      const festUrl = `${BASE_API_URL}/api/proxy?region=${region}&month=${targetMonth}&t=${Date.now()}`;
      const festRes = await fetch(festUrl);
      const data = await festRes.json();

      if (data.error || data.message) {
        throw data;
      }

      setFestivals(data.festivals || []);
      const trails = data.trails || [];

      // 2단계: AI 코스 생성 요청 (이동수단 포함)
      const res = await fetch(`${BASE_API_URL}/api/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, taste, condition, trails })
      });

      if (!res.ok) throw new Error("코스 생성 실패");
      const resultData = await res.json();
      setResult(resultData);
      setStep("result");
    } catch (err: any) { 
      console.error("축제 데이터 요청 실패:", err);
      const serverMsg = err.error || "데이터 요청 실패";
      const detailMsg = err.details ? `\n상세: ${err.details}` : "";
      setFestMessage(`[DEBUG] ${serverMsg}${detailMsg}`); 
      setFestivals([]); 
    }
    finally { setFestLoading(false); }
  };

  const rollTheme = async () => {
    if (loading) return;
    triggerHaptic(); setLoading(true); setErrorMsg("");
    try {
      // 1. 데이터 정제 (불필요한 참조 제거)
      const payload = JSON.parse(JSON.stringify({ profile, taste, condition }));
      const PROXY_URL = `${BASE_API_URL}/api/proxy`;
      console.log("Requesting AI theme from:", PROXY_URL, "with payload:", payload);

      const fetchPromise = fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });

      // 최소 로딩 시간과 실제 요청 병렬 실행
      const [res] = await Promise.all([
        fetchPromise,
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      if (!res.ok) {
        let errorInfo = `HTTP ${res.status}`;
        try { const errData = await res.json(); errorInfo = errData.error || errorInfo; } catch (e) { }
        throw new Error(errorInfo);
      }

      const parsedResult = await res.json();
      if (!parsedResult || !parsedResult.theme) throw new Error("추천 데이터를 받지 못했습니다.");

      setResult(parsedResult);
      setStep("result");
    } catch (err: any) {
      console.error("Critical Error:", err);
      let msg = err.name === "TypeError" ? "네트워크 연결 오류 (CORS/URL)" : (err.message || "알 수 없는 오류");
      // 특정 브라우저 에러 메시지 한글화 및 우회 안내
      if (msg.includes("expected pattern") || msg.includes("Failed to fetch")) {
        msg = "연결이 원활하지 않습니다. 잠시 후 '테마 뽑기'를 다시 눌러주세요.";
      }
      setErrorMsg(`⚠️ ${msg}`);
    }
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
    } catch (err) { } finally { setTimeout(() => setIsSharing(false), 500); }
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
              {["profile", "stamina", "taste", "condition"].map((s, i) => (
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
            <p style={{ textAlign: "center", color: "#ADB5BD", fontSize: 12, marginTop: 16 }}>v2.1.0</p>
          </div>
        )}

        {step === "profile" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>누구와 함께 가나요?</h2>
            <div style={{ background: "#FFF", padding: 24, borderRadius: 16, marginBottom: 20 }}>
              <p style={{ fontWeight: 700, marginBottom: 16 }}>😎 나의 나이</p>
              <input type="number" value={profile.myAge} onChange={e => setProfile({ ...profile, myAge: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #EEE" }} />
            </div>
            <div style={{ background: "#FFF", padding: 24, borderRadius: 16, marginBottom: 32 }}>
              <p style={{ fontWeight: 700, marginBottom: 16 }}>🧑‍🤝‍🧑 동행인 나이</p>
              <input type="number" value={profile.partnerAge} onChange={e => setProfile({ ...profile, partnerAge: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #EEE" }} />
            </div>
            <button className="roll-btn" onClick={() => setStep("stamina")}>다음</button>
            <button className="roll-btn" style={{ background: "none", color: "#8B95A1", marginTop: 12 }} onClick={() => setStep("start")}>이전으로</button>
          </div>
        )}

        {step === "stamina" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>오늘 우리의 체력은 어떤가요?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {[
                { id: "에너자이저", title: "🔋 에너자이저", desc: "하루 종일 걸어도 지치지 않아요" },
                { id: "보통", title: "🙂 보통", desc: "적당히 걷고 적당히 쉬고 싶어요" },
                { id: "종이인형", title: "🪫 종이인형", desc: "최대한 덜 걷고 푹 쉬는 게 최고예요" }
              ].map(v => (
                <button 
                  key={v.id} 
                  style={{ 
                    textAlign: "left", padding: "20px", borderRadius: "16px", 
                    border: condition.체력 === v.id ? "2px solid #3182F6" : "1px solid #E5E8EB",
                    background: condition.체력 === v.id ? "#F2F8FF" : "#FFF",
                    transition: "all 0.2s"
                  }}
                  onClick={() => setCond("체력", v.id)}
                >
                  <p style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px 0", color: condition.체력 === v.id ? "#3182F6" : "#191F28" }}>{v.title}</p>
                  <p style={{ fontSize: 14, color: "#6B7684", margin: 0 }}>{v.desc}</p>
                </button>
              ))}
            </div>
            <button className="roll-btn" onClick={() => setStep("taste")}>다음</button>
            <button className="roll-btn" style={{ background: "none", color: "#8B95A1", marginTop: 12 }} onClick={() => setStep("profile")}>이전으로</button>
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
            <button className="roll-btn" style={{ background: "none", color: "#8B95A1", marginTop: 12 }} onClick={() => setStep("stamina")}>이전으로</button>
          </div>
        )}

        {step === "condition" && (
          <div className="fade-up">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>마지막으로, 환경을 알려주세요</h2>
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
            <button className="roll-btn" onClick={() => setStep("stamina")}>다음</button>
            <button className="roll-btn" style={{ background: "none", color: "#8B95A1", marginTop: 12 }} onClick={() => setStep("taste")}>이전으로</button>
          </div>
        )}

            <button className="roll-btn" onClick={rollTheme}>테마 설계하기</button>
            <button className="roll-btn" style={{ background: "none", color: "#8B95A1", marginTop: 12 }} onClick={() => setStep("taste")}>이전으로</button>
          </div>
        )}

        {step === "result" && result && (
          <div className="fade-up">
            <div style={{ background: "#FFF", borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", marginBottom: 20 }}>
              <div style={{ padding: 40, background: "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)", textAlign: "center" }}>
                <div style={{ fontSize: 64, marginBottom: 20 }}>{result.emoji}</div>
                <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: "#191F28", letterSpacing: "-0.5px" }}>{result.theme}</h2>
                <p style={{ color: "#4E5968", fontSize: 16, lineHeight: 1.6, marginBottom: 20, fontWeight: 500 }}>{result.desc}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  {result.vibe.map(v => <span key={v} style={{ color: "#3182F6", background: "#FFF", padding: "6px 14px", borderRadius: "20px", fontSize: 14, fontWeight: 600, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>{v}</span>)}
                </div>
              </div>
              
              <div style={{ padding: "32px 24px" }}>
                {result.transportInfo && (
                  <div style={{ background: "#F2F4F6", padding: "18px 20px", borderRadius: "20px", marginBottom: 32, display: "flex", alignItems: "flex-start", gap: 14, border: "1px solid #E5E8EB" }}>
                    <span style={{ fontSize: 22 }}>{condition.이동수단?.includes("자차") ? "🚗" : "🚌"}</span>
                    <div>
                      <p style={{ fontSize: 14, color: "#4E5968", fontWeight: 600, margin: "0 0 4px 0" }}>이동 가이드</p>
                      <p style={{ fontSize: 14, color: "#6B7684", margin: 0, lineHeight: 1.5 }}>{result.transportInfo}</p>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
                  <div style={{ flex: 1, background: "#F9FAFB", padding: 16, borderRadius: 16, textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#8B95A1", fontWeight: 600, marginBottom: 4 }}>소요 시간</p>
                    <p style={{ fontSize: 15, color: "#333D4B", fontWeight: 700, margin: 0 }}>{result.duration || "약 4시간"}</p>
                  </div>
                  <div style={{ flex: 1, background: "#F9FAFB", padding: 16, borderRadius: 16, textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#8B95A1", fontWeight: 600, marginBottom: 4 }}>추천 시간</p>
                    <p style={{ fontSize: 15, color: "#333D4B", fontWeight: 700, margin: 0 }}>{result.bestTime || "오후 무렵"}</p>
                  </div>
                </div>

                <p style={{ fontSize: 14, fontWeight: 700, color: "#191F28", marginBottom: 24, paddingLeft: 4 }}>오늘의 장면들</p>
                
                {result.doThis.map((item: any, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 20, marginBottom: 36, alignItems: "flex-start" }}>
                    <div style={{
                      color: "#3182F6",
                      fontSize: 13,
                      fontWeight: 800,
                      background: "#E8F3FF",
                      width: 32,
                      height: 32,
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#333D4B", marginBottom: 8, lineHeight: 1.4 }}>{item.title}</h3>
                      <p style={{ color: "#6B7684", fontSize: 15, lineHeight: 1.7, margin: 0, wordBreak: "keep-all" }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 오늘의 대화 주제 */}
            <div style={{ borderRadius: 20, padding: "24px", background: "#FFFFFF", marginBottom: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.03)", border: "1px solid #F2F4F6" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#3182F6", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span>💬</span> 오늘의 대화 주제
              </p>
              <p style={{ fontSize: 16, color: "#333D4B", fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
                "{result.talkTopic}"
              </p>
            </div>

            {/* 주변 추천 장소 섹션 */}
            {result.nearby && result.nearby.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#191F28", marginBottom: 16, paddingLeft: 4 }}>근처 함께 가볼 만한 곳 📍</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {result.nearby.map((place: any, i: number) => (
                    <div key={i} style={{ background: "#FFF", padding: "16px", borderRadius: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #F2F4F6" }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#333D4B", margin: "0 0 2px 0" }}>{place.name}</p>
                        <p style={{ fontSize: 13, color: "#8B95A1", margin: 0 }}>{place.type} · {place.reason}</p>
                      </div>
                      <span style={{ fontSize: 20 }}>{place.emoji}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 다음을 위한 테마 (예약 장소 포함) */}
            {result.nextTheme && (
              <div style={{ borderRadius: 20, padding: "24px", background: "#F9FAFB", marginBottom: 32, border: "1px solid #E5E8EB" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#8B95A1", marginBottom: 8, textTransform: "uppercase" }}>Next Journey Plan 🗓️</p>
                <h4 style={{ fontSize: 17, fontWeight: 700, color: "#333D4B", marginBottom: 12 }}>{result.nextTheme.title}</h4>
                <p style={{ fontSize: 14, color: "#4E5968", lineHeight: 1.5, marginBottom: 16 }}>{result.nextTheme.desc}</p>
                {result.nextTheme.isReservationRequired && (
                  <div style={{ background: "#FFF", padding: "12px 16px", borderRadius: "12px", border: "1px dashed #3182F6", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🔔</span>
                    <p style={{ fontSize: 13, color: "#3182F6", fontWeight: 600, margin: 0 }}>이곳은 미리 예약이 필요한 장소예요.</p>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 40 }}>
              <button className="roll-btn" style={{ background: "#E5E8EB", color: "#4E5968", flex: 1 }} onClick={reset}>처음으로</button>
              <button className="roll-btn" style={{ flex: 2 }} onClick={rollTheme}>다시 설계하기</button>
            </div>
          </div>
        )}

        {/* 하단 광고 영역 */}
        <BannerAd adGroupId={AD_GROUP_ID} />
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
                          {f.eventstartdate.slice(4, 6)}.{f.eventstartdate.slice(6, 8)} ~ {f.eventenddate?.slice(4, 6)}.{f.eventenddate?.slice(6, 8)}
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
