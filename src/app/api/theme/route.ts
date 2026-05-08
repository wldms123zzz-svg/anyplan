import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { profile, taste, condition } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    const tourKey = process.env.TOUR_API_KEY;

    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    let realData = "";
    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    const areaCode = AREA_CODES[condition.지역] || "";

    // 실시간 지역 데이터 페칭 (안정적인 직접 fetch 사용)
    if (tourKey && areaCode) {
      try {
        const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&areaCode=${areaCode}&numOfRows=15&arrange=Q`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();
        const items = data?.response?.body?.items?.item;
        if (items) {
          realData = (Array.isArray(items) ? items : [items])
            .map((i: any) => `${i.title}(${i.addr1 || ""})`)
            .join(", ");
        }
      } catch (e) {
        console.warn("Tour API Error, but continuing to AI...");
      }
    }

    // Gemini API 직접 호출 (SDK 충돌 방지 및 Edge 런타임 최적화)
    const prompt = `
      당신은 대한민국 최고의 '지역 전문 데이트 플래너'입니다.

      [핵심 요청]
      사용자가 선택한 지역(${condition.지역})의 특색을 200% 살린 시적이고 풍성한 데이트 테마를 제안하세요.
      반드시 제공된 '현지 실시간 데이터'를 활용하여 실제 상호명과 주소가 포함된 3단계 동선을 짜야 합니다.

      [사용자 정보]
      지역: ${condition.지역}, 무드: ${taste.무드}, 활동: ${taste.활동}, 예산: ${condition.예산}
      상태: 본인(${condition.상태}), 상대방(${condition.동행인상태})

      [현지 실시간 데이터]
      ${realData}

      [응답 형식 (JSON)]
      - theme: 아주 시적이고 감성적인 제목
      - vibe: 3개 이상의 해시태그
      - desc: 3문장 이상의 풍부한 설명
      - doThis: 실제 지명이 포함된 3단계 상세 코스
      - transportInfo: 구체적인 교통/주차 팁
      - talkTopic: 대화 주제
      - randomTwist: "더 재밌게 하려면?" 섹션용 깜짝 미션
      - perfectFor: 타겟 커플 묘사

      JSON 형식으로만 답변하세요.
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("AI 응답 없음");
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error("Critical Error:", error);
    
    // 지역 맞춤형 폴백 시스템
    const isJeju = req.url.includes("제주") || JSON.stringify(req.body).includes("제주");
    
    if (isJeju) {
      return NextResponse.json({
        theme: "제주 에메랄드빛 해안 산책",
        emoji: "🌊",
        desc: "제주의 푸른 바다를 곁에 두고 걷는 낭만적인 시간입니다.",
        vibe: "#제주감성 #바다멍 #힐링산책",
        doThis: ["협재 해변 모래사장 걷기", "근처 오션뷰 카페에서 차 마시기", "노을 배경으로 인생샷 찍기"],
        transportInfo: "제주 버스 202번 혹은 렌터카 이용을 권장합니다.",
        talkTopic: "우리 제주도에서 살게 된다면 어떨까?",
        randomTwist: "바닷가에서 예쁜 조개껍데기 하나씩 찾아주기!",
        perfectFor: "바다를 사랑하는 모든 커플"
      });
    }

    return NextResponse.json({
      theme: "도심 속 낭만 산책",
      emoji: "🏙️",
      desc: "지친 일상을 잠시 잊고 가까운 곳에서 즐기는 여유로운 데이트입니다.",
      vibe: "#도심힐링 #함께걷기 #소소한행복",
      doThis: ["근처 공원 산책하기", "분위기 좋은 골목 맛집 탐방", "야경이 예쁜 곳에서 대화하기"],
      transportInfo: "가까운 지하철역이나 대중교통 이용이 가장 편리합니다.",
      talkTopic: "오늘 우리 데이트 점수를 매긴다면 몇 점?",
      randomTwist: "서로의 장점 하나씩 말해준 뒤 하이파이브!",
      perfectFor: "도심 속 쉼표가 필요한 커플"
    });
  }
}
