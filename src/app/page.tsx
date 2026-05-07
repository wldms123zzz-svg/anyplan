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
    // Hydration 이슈 방지를 위해 클라이언트에서만 날짜 설정
    setSelectedMonth(new Date().getMonth() + 1);

    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get("data");
    if (sharedData) {
      try {
        // btoa/atob 대신 안전한 URL 인코딩 데이터 복구
        const decodedData = decodeURIComponent(sharedData);
        const parsed = JSON.parse(decodedData);
        setResult(parsed);
        setStep("result");
      } catch (e) {
        console.error("공유 데이터 파싱 실패", e);
      }
    }
  }, []);

  // 토스 광고 로드
  useEffect(() => {
    if (step === "result" && !loading) {
      if (typeof window !== "undefined" && (window as any).toss?.ad?.showBanner) {
        (window as any).toss.ad.showBanner({
          adGroupId: "ait.v2.live.0cdc8d469958499a",
          container: "#toss-ad-container",
        });
      }
    }
  }, [step, loading]);

  // 로딩 메시지 및 꿀팁 다이나믹 변경 (지루함 방지)
  useEffect(() => {
    let interval: any;
    let tipInterval: any;
    let timer: any;

    if (loading) {
      setCountdown(5);
      const messages = [
        "📡 전국 축제 네트워크 접속 중...",
        "🧠 완벽한 동선 설계 중...",
        "🗺️ 지도를 펼쳐보는 중...",
        "✨ 분위기 좋은 장소 찾는 중...",
        "💡 특별한 대화 주제 고르는 중...",
      ];
      const tips = [
        "💡 팁: 첫 데이트라면 너무 조용한 곳보다 약간의 소음이 있는 곳이 긴장을 풀어줘요.",
        "💡 팁: 이동 중에는 상대방의 플레이리스트를 함께 들어보세요.",
        "💡 팁: 가끔은 계획에 없던 골목길 산책이 더 기억에 남기도 해요.",
        "💡 팁: 사진을 찍어줄 땐 수평을 맞추고 발끝을 화면 하단에 맞춰보세요!",
        "💡 팁: 상대방의 컨디션을 수시로 체크하는 센스가 필요해요.",
        "💡 팁: 대화가 끊길 땐 '가장 최근에 본 재밌는 영상' 이야기를 꺼내보세요.",
      ];
      
      let i = 0;
      let j = 0;
      setLoadingText(messages[0]);
      setLoadingTextTip(tips[0]);

      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingText(messages[i]);
      }, 1500);

      tipInterval = setInterval(() => {
        j = (j + 1) % tips.length;
        setLoadingTextTip(tips[j]);
      }, 2500);

      timer = setInterval(() => {
        setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);
    }
    return () => {
      clearInterval(interval);
      clearInterval(tipInterval);
      clearInterval(timer);
    };
  }, [loading]);

  // 토스 햅틱 래퍼 (안전하게 호출)
  const triggerHaptic = (type = "light") => {
    if (typeof window !== "undefined" && (window as any).toss?.haptic) {
      (window as any).toss.haptic(type);
    }
  };

  const toggle = (cat: string, val: string) => {
    triggerHaptic("light");
    setTaste((p: any) => ({
      ...p,
      [cat]: p[cat].includes(val) ? p[cat].filter((v: string) => v !== val) : [...p[cat], val]
    }));
  };

  const setCond = (key: string, val: string) => {
    triggerHaptic("light");
    setCondition((p: any) => ({ ...p, [key]: val }));
  };

  const reset = () => {
    triggerHaptic();
    setStep("start");
    setTaste({ 무드: [], 활동: [] });
    setCondition({ myBody: "", partnerBody: "", 예산: "", 지역: "전국", mode: "", 이동수단: "" });
    setResult(null);
    setErrorMsg("");
  };




  const fetchFestivals = async (month?: number) => {
    if (festLoading) return;
    const targetMonth = month || selectedMonth;
    if (month) setSelectedMonth(month);
    
    triggerHaptic();
    setFestLoading(true);
    setShowFestivals(true);
    setFestMessage("");

    try {
      const res = await fetch("/api/festivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: condition.지역, month: targetMonth }),
      });
      const data = await res.json();
      if (data.error) {
        setFestMessage(data.error);
        setFestivals([]);
      } else if (data.message) {
        setFestMessage(data.message);
        setFestivals([]);
      } else {
        setFestivals(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setFestMessage("축제 정보를 불러오는 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setFestivals([]);
    } finally {
      setFestLoading(false);
    }
  };

  const rollTheme = async () => {
    if (loading) return;
    triggerHaptic();
    setLoading(true);
    setErrorMsg("");
    
    // 로컬 데이터베이스 (API 실패 시 대비용)
    const LOCAL_FALLBACKS = [
      { theme: "편의점 야식 + 드라마 정주행", emoji: "🍜", desc: "각자 먹고 싶은 거 고르고 소파에서 뒹굴뒹굴", vibe: "#편안함 #야식폭탄", doThis: ["편의점 털기", "드라마 정주행"], talkTopic: "과거로 돌아간다면?", randomTwist: "먹방 찍기", perfectFor: "집돌이 커플" },
      { theme: "따릉이 레이스 + 한강 라면", emoji: "🚲", desc: "시원한 강바람 맞으며 자전거 타기", vibe: "#활동적 #낭만", doThis: ["자전거 타기", "즉석라면 먹기"], talkTopic: "올해 가장 행복한 순간?", randomTwist: "라면 내기", perfectFor: "운동 좋아하는 커플" },
      { theme: "방구석 세계 미식 여행", emoji: "✈️", desc: "이국적인 음식 배달시켜 먹기", vibe: "#이색적 #배부름", doThis: ["태국 음식 배달", "여행 브이로그 시청"], talkTopic: "가고 싶은 나라는?", randomTwist: "현지어로 건배하기", perfectFor: "여행광 커플" },
      { theme: "보드게임 카페 내기", emoji: "🎲", desc: "두뇌 풀가동 보드게임 대결", vibe: "#승부욕 #신남", doThis: ["스플랜더 하기", "벌칙 정하기"], talkTopic: "나의 장점과 약점은?", randomTwist: "진 사람이 소원 들어주기", perfectFor: "내기 좋아하는 커플" },
      { theme: "서점 데이트 + 책 교환", emoji: "📚", desc: "서로에게 어울리는 책 선물하기", vibe: "#차분함 #감성", doThis: ["책 골라주기", "카페에서 읽기"], talkTopic: "이 책을 고른 이유?", randomTwist: "책에 편지 쓰기", perfectFor: "지적인 커플" }
    ];

    try {
      const res = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, taste, condition }),
      });
      
      if (!res.ok) throw new Error("API Offline");
      const data = await res.json();
      setResult(data);
      setStep("result");
    } catch (err) {
      console.warn("API 호출 실패, 로컬 데이터로 전환합니다.", err);
      // API 실패 시 로컬에서 하나 랜덤으로 뽑기
      const randomFallback = LOCAL_FALLBACKS[Math.floor(Math.random() * LOCAL_FALLBACKS.length)];
      setResult(randomFallback);
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    triggerHaptic("light");
    if (!result) {
      setIsSharing(false);
      return;
    }

    // 데이터 인코딩 (btoa 대신 안전한 URL 인코딩 방식 사용)
    const encodedData = encodeURIComponent(JSON.stringify(result));
    const shareUrl = `${window.location.origin}${window.location.pathname}?data=${encodedData}`;
    
    const shareText = `[오늘 뭐하지? 🎲]\n오늘의 추천 데이트: ${result.theme}\n\n${result.desc}\n${result.vibe}\n\n상대방의 의견을 들려주세요!\n${shareUrl}`;
    
    try {
      if (typeof window !== "undefined" && (window as any).toss?.share) {
        await (window as any).toss.share({
          text: shareText,
        });
      } else if (navigator.share) {
        await navigator.share({
          title: "오늘 뭐하지? 데이트 추천",
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert("공유 링크와 내용이 복사되었습니다!");
      }
    } catch (err) {
      console.error("Share failed", err);
      // 취소된 경우 에러 로그만 남김
    } finally {
      // 약간의 지연 후 상태 해제하여 중복 클릭 방지
      setTimeout(() => setIsSharing(false), 500);
    }
  };

  const handleVote = (vote: string) => {
    triggerHaptic(vote === "agree" ? "success" : "light");
    setPartnerVote(vote);
    
    // 투표 결과를 다시 공유할 수 있게 텍스트 생성
    const voteText = vote === "agree" ? "👍 이 데이트 찬성! 완전 좋아." : "👎 음, 이건 좀 별로야. 다른 거 뽑아보자!";
    
    if (confirm(`${vote === "agree" ? "찬성" : "반대"}하셨습니다! 결과를 상대방에게 보낼까요?`)) {
      if (typeof window !== "undefined" && (window as any).toss?.share) {
        (window as any).toss.share({ text: voteText });
      } else if (navigator.share) {
        navigator.share({ text: voteText });
      } else {
        navigator.clipboard.writeText(voteText);
        alert("투표 결과가 복사되었습니다. 상대방에게 보내주세요!");
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F6", color: "#191F28", fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rolling {
          0% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.2) rotate(90deg) translateY(-20px); }
          50% { transform: scale(1) rotate(180deg) translateY(0); }
          75% { transform: scale(1.2) rotate(270deg) translateY(-20px); }
          100% { transform: scale(1) rotate(360deg) translateY(0); }
        }

        .fade-up { animation: fadeUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .rolling {
          animation: rolling 2s infinite cubic-bezier(0.45, 0.05, 0.55, 0.95);
          display: inline-block;
          filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));
        }

        .tag-btn {
          padding: 12px 16px;
          border-radius: 12px;
          border: none;
          background: #FFFFFF;
          color: #4E5968;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .tag-btn:active { transform: scale(0.96); }
        .tag-btn.active {
          background: #E8F3FF;
          color: #3182F6;
          font-weight: 600;
        }

        .mode-card {
          border: none;
          border-radius: 16px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #FFFFFF;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .mode-card:active { transform: scale(0.98); }
        .mode-card.active {
          background: #E8F3FF;
          box-shadow: inset 0 0 0 2px #3182F6;
        }

        .roll-btn {
          width: 100%;
          padding: 18px;
          border-radius: 16px;
          border: none;
          background: #3182F6;
          color: #FFFFFF;
          font-size: 17px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .roll-btn:active:not(:disabled) { transform: scale(0.98); background: #1B64DA; }
        .roll-btn:disabled { background: #D1D6DB; color: #FFFFFF; cursor: not-allowed; }

        .roll-btn:disabled { background: #D1D6DB; color: #FFFFFF; cursor: not-allowed; }
        
        .loading-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 24px;
          text-align: center;
          backdrop-filter: blur(8px);
        }

        .result-card {
          border-radius: 24px;
          background: #FFFFFF;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
        }

        .step-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #D1D6DB;
          flex-shrink: 0;
          margin-top: 6px;
          transition: background 0.3s;
        }
        .step-dot.active { background: #3182F6; }
        
        .section-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 8px;
          color: #191F28;
        }
        
        .section-desc {
          color: #8B95A1;
          font-size: 15px;
          margin-bottom: 24px;
          line-height: 1.5;
        }
      `}</style>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="loading-overlay fade-up">
          <div style={{ fontSize: 64, marginBottom: 32 }} className="rolling">🎲</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#191F28" }}>{loadingText}</h2>
          <p style={{ fontSize: 16, color: "#4E5968", marginBottom: 32 }}>
            AI가 가장 기발한 코스를 짜는 중입니다.<br />
            <strong>약 {countdown}초만</strong> 더 기다려주세요!
          </p>
          <div style={{ width: "100%", maxWidth: 200, height: 6, background: "#E5E8EB", borderRadius: 3, overflow: "hidden", marginBottom: 40 }}>
            <div style={{ 
              width: `${((5 - countdown) / 5) * 100}%`, 
              height: "100%", 
              background: "#3182F6", 
              transition: "width 1s linear" 
            }} />
          </div>

          <div className="fade-up" style={{ padding: "16px 20px", background: "#F9FAFB", borderRadius: "12px", border: "1px solid #F2F4F6", width: "100%", maxWidth: 320 }}>
             <p style={{ fontSize: 14, color: "#4E5968", lineHeight: 1.6, wordBreak: "keep-all" }}>{loadingTip}</p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 100px" }}>
        {/* 헤더 */}
        <div style={{ paddingTop: 56, paddingBottom: 24 }}>
          {step === "start" && (
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3, color: "#191F28" }}>
              데이트/외출 테마가<br />고민이신가요? 🎲
            </h1>
          )}
          {step !== "start" && step !== "result" && (
            <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
              {["profile", "taste", "condition"].map((s, i) => (
                <div key={i} className={`step-dot ${
                  step === s || 
                  (s === "profile" && (step === "taste" || step === "condition")) ||
                  (s === "taste" && step === "condition") 
                  ? "active" : ""
                }`} />
              ))}
            </div>
          )}
        </div>

        {/* 에러 메시지 표시 */}
        {errorMsg && (
          <div style={{ background: "#FEE2E2", color: "#EF4444", padding: "16px", borderRadius: "12px", marginBottom: "20px", fontSize: "14px", fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}

        {/* 시작 화면 */}
        {step === "start" && (
          <div className="fade-up">
            <p className="section-desc">
              취향과 컨디션만 고르면<br />
              오늘 딱 맞는 데이트를 골라드릴게요.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 48 }}>
              {[
                { emoji: "⚡️", text: "오늘 바로 당장 할 수 있는 데이트" },
                { emoji: "📅", text: "다음 주말을 위한 맞춤 계획" },
                { emoji: "🤖", text: "AI가 실시간으로 분석해서 제안" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#FFFFFF", padding: "20px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                  <span style={{ fontSize: 24 }}>{item.emoji}</span>
                  <span style={{ fontSize: 16, fontWeight: 500, color: "#333D4B" }}>{item.text}</span>
                </div>
              ))}
            </div>

            <button className="roll-btn" onClick={() => { triggerHaptic(); setStep("profile"); }}>
              시작하기
            </button>
          </div>
        )}

        {/* 프로필 선택 */}
        {step === "profile" && (
          <div className="fade-up">
            <h2 className="section-title">누구와 함께 가나요?</h2>
            <p className="section-desc">나이 차이에 따라 맞춤형(예: 부모님)으로 제안해 드려요.</p>

            <div style={{ marginBottom: 32, background: "#FFFFFF", padding: "24px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#333D4B", marginBottom: 16 }}>😎 나의 정보</p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input 
                  type="number" 
                  value={profile.myAge} 
                  onChange={e => setProfile({...profile, myAge: parseInt(e.target.value) || 0})}
                  style={{ width: "80px", padding: "12px", borderRadius: "12px", border: "1px solid #E5E8EB", fontSize: "16px" }}
                /> <span style={{ color: "#4E5968", fontWeight: 500 }}>세</span>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  {["여", "남"].map(g => (
                    <button 
                      key={g} 
                      onClick={() => setProfile({...profile, myGender: g})}
                      style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: profile.myGender === g ? "#3182F6" : "#F2F4F6", color: profile.myGender === g ? "#FFF" : "#4E5968", fontWeight: 600 }}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 32, background: "#FFFFFF", padding: "24px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#333D4B", marginBottom: 16 }}>🧑‍🤝‍🧑 동행인 정보</p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input 
                  type="number" 
                  value={profile.partnerAge} 
                  onChange={e => setProfile({...profile, partnerAge: parseInt(e.target.value) || 0})}
                  style={{ width: "80px", padding: "12px", borderRadius: "12px", border: "1px solid #E5E8EB", fontSize: "16px" }}
                /> <span style={{ color: "#4E5968", fontWeight: 500 }}>세</span>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  {["여", "남"].map(g => (
                    <button 
                      key={g} 
                      onClick={() => setProfile({...profile, partnerGender: g})}
                      style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: profile.partnerGender === g ? "#F04452" : "#F2F4F6", color: profile.partnerGender === g ? "#FFF" : "#4E5968", fontWeight: 600 }}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </div>

            <button className="roll-btn" onClick={() => { triggerHaptic(); setStep("taste"); }}>
              다음
            </button>
          </div>
        )}

        {/* 취향 선택 */}
        {step === "taste" && (
          <div className="fade-up">
            <h2 className="section-title">오늘의 데이트 무드</h2>
            <p className="section-desc">어떤 분위기를 원하시나요? (다중 선택 가능)</p>

            {Object.entries({ 무드: TAGS.무드, 활동: TAGS.활동 }).map(([cat, vals]) => (
              <div key={cat} style={{ marginBottom: 32 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>{cat}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {vals.map(v => (
                    <button
                      key={v}
                      className={`tag-btn ${taste[cat].includes(v) ? "active" : ""}`}
                      onClick={() => toggle(cat, v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => { triggerHaptic(); setStep("profile"); }}
                style={{ flex: "0 0 auto", padding: "18px 24px", borderRadius: "16px", border: "none", background: "#E5E8EB", color: "#4E5968", cursor: "pointer", fontSize: 16, fontWeight: 600 }}
              >
                이전
              </button>
              <button className="roll-btn" style={{ flex: 1 }} onClick={() => { triggerHaptic(); setStep("condition"); }}>
                다음
              </button>
            </div>
          </div>
        )}

        {/* 컨디션 선택 */}
        {step === "condition" && (
          <div className="fade-up">
            <h2 className="section-title">오늘 컨디션 & 예산</h2>
            <p className="section-desc">현재 기분과 상황을 솔직하게 골라주세요.</p>

            {/* 몸 상태 */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>내 몸 상태</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {TAGS.몸상태.map(v => (
                  <button
                    key={v}
                    className={`tag-btn ${condition.myBody === v ? "active" : ""}`}
                    style={{ textAlign: "center", padding: "14px 10px", fontSize: "14px" }}
                    onClick={() => setCond("myBody", v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>동행인 몸 상태</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {TAGS.몸상태.map(v => (
                  <button
                    key={v}
                    className={`tag-btn ${condition.partnerBody === v ? "active" : ""}`}
                    style={{ textAlign: "center", padding: "14px 10px", fontSize: "14px" }}
                    onClick={() => setCond("partnerBody", v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* 예산 */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>예산</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {TAGS.예산.map(v => (
                  <button
                    key={v}
                    className={`tag-btn ${condition.예산 === v ? "active" : ""}`}
                    style={{ padding: "18px 20px", fontSize: "16px", fontWeight: condition.예산 === v ? 700 : 500 }}
                    onClick={() => setCond("예산", v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* 지역 (문화생활/축제 연동) */}
            <div style={{ marginBottom: 40, background: "#F9FAFB", padding: "20px", borderRadius: "16px", border: "1px solid #F2F4F6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#333D4B", margin: 0 }}>🎪 근처 지역축제/전시 찾아보기</p>
              </div>
              <p style={{ fontSize: 13, color: "#8B95A1", marginBottom: 16 }}>해당 지역의 실제 행사 정보를 데이트 코스에 반영합니다.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TAGS.지역.map(v => (
                  <button
                    key={v}
                    style={{
                      padding: "8px 14px", borderRadius: "20px", border: "none", fontSize: "14px", fontWeight: 500, cursor: "pointer",
                      background: condition.지역 === v ? "#3182F6" : "#FFFFFF",
                      color: condition.지역 === v ? "#FFFFFF" : "#4E5968",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                    }}
                    onClick={() => setCond("지역", v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* 이동수단 */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>이동 수단</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {TAGS.이동수단.map(v => (
                  <button
                    key={v}
                    className={`tag-btn ${condition.이동수단 === v ? "active" : ""}`}
                    style={{ textAlign: "center", padding: "14px 10px", fontSize: "14px" }}
                    onClick={() => setCond("이동수단", v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* 모드 및 축제 정보 */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", margin: 0 }}>상황 및 축제 정보</p>
                {condition.지역 && condition.지역 !== "전국" && (
                  <button 
                    onClick={() => fetchFestivals()}
                    style={{ 
                      fontSize: 12, padding: "6px 10px", borderRadius: "8px", border: "none", 
                      background: "#F2F4F6", color: "#3182F6", fontWeight: 600, cursor: "pointer" 
                    }}
                  >
                    🎭 {condition.지역} 다가오는 축제
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { id: "today", emoji: "⚡️", label: "오늘 바로", sub: "지금 당장 할 수 있는" },
                  { id: "plan", emoji: "📅", label: "미리 계획", sub: "다음 데이트용" }
                ].map(m => (
                  <button
                    key={m.id}
                    className={`mode-card ${condition.mode === m.id ? "active" : ""}`}
                    onClick={() => setCond("mode", m.id)}
                    style={{ textAlign: "left" }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 12 }}>{m.emoji}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: condition.mode === m.id ? "#3182F6" : "#333D4B", marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 13, color: condition.mode === m.id ? "#8B95A1" : "#8B95A1" }}>{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => { triggerHaptic(); setStep("taste"); }}
                style={{ flex: "0 0 auto", padding: "18px 24px", borderRadius: "16px", border: "none", background: "#E5E8EB", color: "#4E5968", cursor: "pointer", fontSize: 16, fontWeight: 600 }}
              >
                이전
              </button>
              <button
                className="roll-btn"
                style={{ flex: 1 }}
                disabled={!condition.myBody || !condition.partnerBody || !condition.예산 || !condition.mode || loading}
                onClick={rollTheme}
              >
                {loading ? loadingText : "테마 뽑기"}
              </button>
            </div>
          </div>
        )}

        {/* 결과 화면 */}
        {step === "result" && result && (
          <div className="fade-up">
            <div className="result-card" style={{ marginBottom: 20 }}>
              <div style={{ padding: "32px 24px 24px", background: "#F9FAFB" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 56, lineHeight: 1 }} ref={diceRef} className={rolling ? "rolling" : ""}>
                    {result.emoji}
                  </div>
                </div>

                <h2 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, marginBottom: 10, color: "#191F28" }}>
                  {result.theme}
                </h2>
                <p style={{ color: "#4E5968", fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>
                  {result.desc}
                </p>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#3182F6" }}>
                  {result.vibe}
                </p>
              </div>

              <div style={{ padding: "24px" }}>
                {result.transportInfo && (
                  <div style={{ background: "#F2F4F6", padding: "12px 16px", borderRadius: "12px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{condition.이동수단?.includes("뚜벅이") ? "🚇" : "🅿️"}</span>
                    <span style={{ fontSize: 13, color: "#4E5968", fontWeight: 500 }}>{result.transportInfo}</span>
                  </div>
                )}

                <p style={{ fontSize: 13, fontWeight: 600, color: "#8B95A1", marginBottom: 16 }}>추천 활동</p>
                {result.doThis?.map((item: string, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 0", borderBottom: i === result.doThis.length - 1 ? "none" : "1px solid #F2F4F6" }}>
                    <span style={{ color: "#3182F6", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ color: "#333D4B", fontSize: 15, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 16, padding: "20px 24px", background: "#FFFFFF", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#8B95A1", marginBottom: 8 }}>오늘의 대화 주제</p>
              <p style={{ color: "#333D4B", fontSize: 15, lineHeight: 1.6 }}>💬 {result.talkTopic}</p>
            </div>

            <div style={{ borderRadius: 16, padding: "20px 24px", background: "#E8F3FF", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#3182F6", marginBottom: 8 }}>더 재밌게 하려면?</p>
              <p style={{ color: "#1960CA", fontSize: 15, lineHeight: 1.6 }}>✨ {result.randomTwist}</p>
            </div>

            <div style={{ borderRadius: 16, padding: "20px 24px", background: "#FFFFFF", marginBottom: 32, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <p style={{ color: "#4E5968", fontSize: 15, lineHeight: 1.6 }}>🫶 {result.perfectFor}</p>
            </div>

            {/* AI 할루시네이션 면책 문구 */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: "#8B95A1", lineHeight: 1.5 }}>
                ⚠️ AI가 제안한 특정 상호명(가게, 장소)은 현재 폐업했거나 정보가 다를 수 있습니다.<br />
                방문 전 반드시 지도 앱에서 실제 상호명이 일치하는지 교차검증해 주세요!
              </p>
            </div>

            {/* 투표 버튼 (공유받은 경우) */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => handleVote("agree")}
                style={{
                  flex: 1, padding: "16px", borderRadius: "16px", border: "none",
                  background: partnerVote === "agree" ? "#3182F6" : "#FFFFFF",
                  color: partnerVote === "agree" ? "#FFFFFF" : "#3182F6",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)", fontSize: "16px", fontWeight: 700, cursor: "pointer"
                }}
              >
                👍 찬성
              </button>
              <button
                onClick={() => handleVote("disagree")}
                style={{
                  flex: 1, padding: "16px", borderRadius: "16px", border: "none",
                  background: partnerVote === "disagree" ? "#F04452" : "#FFFFFF",
                  color: partnerVote === "disagree" ? "#FFFFFF" : "#F04452",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)", fontSize: "16px", fontWeight: 700, cursor: "pointer"
                }}
              >
                👎 반대
              </button>
            </div>

            {/* 버튼들 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                className="roll-btn"
                onClick={handleShare}
                disabled={isSharing}
                style={{ background: "#F2F4F6", color: "#3182F6", border: "1px solid #E8F3FF" }}
              >
                {isSharing ? "공유 중..." : "결과 공유하기"}
              </button>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={reset}
                  style={{ flex: "0 0 auto", padding: "18px 24px", borderRadius: "16px", border: "none", background: "#E5E8EB", color: "#4E5968", cursor: "pointer", fontSize: 16, fontWeight: 600 }}
                >
                  처음으로
                </button>
                <button
                  className="roll-btn"
                  style={{ flex: 1 }}
                  onClick={rollTheme}
                  disabled={loading}
                >
                  {loading ? loadingText : "다시 뽑기"}
                </button>
              </div>
            </div>

            {/* 토스 광고 영역 */}
            <div id="toss-ad-container" style={{ width: "100%", minHeight: "100px", marginTop: "32px", borderRadius: "16px", overflow: "hidden" }}></div>
          </div>
        )}

      </div>
      {/* 축제 모달 */}
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
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
