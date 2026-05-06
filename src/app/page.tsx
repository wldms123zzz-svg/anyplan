"use client";
import { useState, useEffect, useRef } from "react";

// 취향 태그 풀
const TAGS = {
  분위기: ["조용한", "신나는", "낭만적인", "웃긴", "설레는", "편안한"],
  활동: ["먹기", "걷기", "보기", "만들기", "배우기", "놀기", "문화/축제"],
  에너지: ["집에서 쉬고 싶음", "살짝 나가고 싶음", "신나게 돌아다니고 싶음"],
  예산: ["공짜면 최고", "3만원 이하", "10만원 이하", "돈 좀 써도 됨"],
  지역: ["전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
};

export default function DateThemeApp() {
  const [step, setStep] = useState("start");
  const [taste, setTaste] = useState<any>({ 분위기: [], 활동: [] });
  const [condition, setCondition] = useState<any>({ 에너지: "", 예산: "", 지역: "전국", mode: "" });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [partnerVote, setPartnerVote] = useState<string | null>(null); // 'agree' | 'disagree'
  const diceRef = useRef<HTMLDivElement>(null);

  // 공유된 데이터 로드 (URL 파라미터)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get("data");
    if (sharedData) {
      try {
        const decoded = JSON.parse(atob(sharedData));
        setResult(decoded);
        setStep("result");
      } catch (e) {
        console.error("공유 데이터 파싱 실패", e);
      }
    }
  }, []);

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

  const canGoResult = condition.에너지 && condition.예산 && condition.mode;

  const rollTheme = async () => {
    triggerHaptic("success");
    setLoading(true);
    setRolling(true);
    setErrorMsg("");

    setTimeout(() => {
      setRolling(false);
      triggerHaptic("success");
    }, 1200);

    try {
      // 넥스트 API 라우트로 요청
      const res = await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taste, condition }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "테마 생성 중 오류가 발생했습니다.");
      }

      setResult(data);
      setStep("result");
      triggerHaptic("success");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "API 연결에 실패했습니다. (크레딧이나 키 설정을 확인해주세요)");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    triggerHaptic("light");
    setStep("start");
    setTaste({ 분위기: [], 활동: [] });
    setCondition({ 에너지: "", 예산: "", mode: "" });
    setResult(null);
    setErrorMsg("");
  };

  const reroll = () => {
    triggerHaptic("success");
    setResult(null);
    rollTheme();
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    triggerHaptic("light");
    if (!result) {
      setIsSharing(false);
      return;
    }

    // 데이터 인코딩 (Base64)
    const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
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
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes roll {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(15deg) scale(1.1); }
          50% { transform: rotate(-10deg) scale(0.95); }
          75% { transform: rotate(8deg) scale(1.05); }
          100% { transform: rotate(0deg) scale(1); }
        }

        .fade-up { animation: fadeUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .rolling { animation: roll 0.3s ease infinite; display: inline-block; }

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

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 100px" }}>
        {/* 헤더 */}
        <div style={{ paddingTop: 56, paddingBottom: 24 }}>
          {step === "start" && (
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3, color: "#191F28" }}>
              데이트 테마가<br />고민이신가요? 🎲
            </h1>
          )}
          {step !== "start" && step !== "result" && (
            <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
              {["taste", "condition"].map((s, i) => (
                <div key={i} className={`step-dot ${step === s || (s === "taste" && step === "condition") ? "active" : ""}`} />
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

            <button className="roll-btn" onClick={() => { triggerHaptic(); setStep("taste"); }}>
              시작하기
            </button>
          </div>
        )}

        {/* 취향 선택 */}
        {step === "taste" && (
          <div className="fade-up">
            <h2 className="section-title">우리 취향</h2>
            <p className="section-desc">여러 개 고르셔도 좋아요. (안 골라도 괜찮아요)</p>

            {Object.entries({ 분위기: TAGS.분위기, 활동: TAGS.활동 }).map(([cat, vals]) => (
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

            <button className="roll-btn" style={{ marginTop: 24 }} onClick={() => { triggerHaptic(); setStep("condition"); }}>
              다음
            </button>
          </div>
        )}

        {/* 컨디션 선택 */}
        {step === "condition" && (
          <div className="fade-up">
            <h2 className="section-title">오늘 컨디션</h2>
            <p className="section-desc">현재 기분과 상황을 솔직하게 골라주세요.</p>

            {/* 에너지 */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>에너지</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {TAGS.에너지.map(v => (
                  <button
                    key={v}
                    className={`tag-btn ${condition.에너지 === v ? "active" : ""}`}
                    style={{ textAlign: "left", padding: "16px 20px" }}
                    onClick={() => setCond("에너지", v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* 예산 */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>예산</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TAGS.예산.map(v => (
                  <button
                    key={v}
                    className={`tag-btn ${condition.예산 === v ? "active" : ""}`}
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

            {/* 모드 */}
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#4E5968", marginBottom: 12 }}>상황</p>
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
                    <div style={{ fontSize: 13, color: condition.mode === m.id ? "#8AABF5" : "#8B95A1" }}>{m.sub}</div>
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
                disabled={!canGoResult || loading}
                onClick={rollTheme}
              >
                {loading ? "AI가 결과 찾는 중..." : "테마 뽑기"}
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
                  onClick={reroll}
                  disabled={loading}
                >
                  {loading ? "AI가 결과 찾는 중..." : "다시 뽑기"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
