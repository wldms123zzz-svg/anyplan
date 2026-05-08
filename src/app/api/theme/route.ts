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

    // 실시간 지역 데이터 페칭 (속도 최적화)
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
      } catch (e) { }
    }

    const prompt = `
      당신은 대한민국 최고의 '지역 전문 데이트 플래너'입니다.

      [핵심 요청]
      1. 반드시 사용자가 선택한 지역(${condition.지역})에 있는 실제 장소와 상호명을 사용하여 코스를 짜세요.
      2. '근처 공원', '맛집 탐방' 같은 추상적인 표현은 절대로 사용하지 마세요. 반드시 구체적인 이름(예: 대구 스파크랜드, 제주 협재해변 등)을 언급하세요.
      3. 오늘의 데이트 코스 3단계(doThis)는 반드시 실시간 데이터와 연결된 구체적인 상호명이어야 합니다.

      [사용자 정보]
      지역: ${condition.지역}, 무드: ${taste.무드}, 활동: ${taste.활동}, 예산: ${condition.예산}

      [현지 실시간 데이터]
      ${realData}

      [응답 형식 (JSON)]
      {
        "theme": "시적인 제목",
        "vibe": ["#태그1", "#태그2", "#태그3"],
        "desc": "감성적인 설명",
        "doThis": ["구체적인 장소명+활동", "구체적인 장소명+활동", "구체적인 장소명+활동"],
        "transportInfo": "버스/지하철/주차 상세 팁",
        "talkTopic": "대화 주제",
        "randomTwist": "깜짝 미션",
        "perfectFor": "타겟 커플",
        "nextDate": { "place": "예약필수 힙플 장소명", "reason": "이유/예약팁", "emoji": "📅" }
      }
    `;

    // 1.5 Flash 모델로 속도와 정확도 균형 (타임아웃 방지)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
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
    
    // 지역별 고품질 프리미엄 백업 DB
    const REGION_FALLBACKS: Record<string, any> = {
      "서울": { theme: "성수동 빈티지 아지트 순례", vibe: ["#성수핫플", "#빈티지감성", "#붉은벽돌"], doThis: ["디올 성수 앞에서 인증샷 찍기", "대림창고에서 커피와 갤러리 감상", "서울숲 튤립 로드 산책하기"], transportInfo: "2호선 성수역 4번 출구에서 도보 이동이 가장 힙해요.", nextDate: { place: "성수 '모노하' 전시", reason: "예약 없이는 못 가는 감성 전시의 끝판왕!" } },
      "대구": { theme: "삼덕동 레트로 감성 탐험", vibe: ["#삼덕동카페", "#김광석거리", "#레트로"], doThis: ["김광석 다시그리기 길에서 버스킹 감상", "삼덕동 숨은 한옥 카페 '수페르가' 방문", "동성로 228공원에서 야경 즐기기"], transportInfo: "경대병원역 3번 출구에서 삼덕동 방향으로 천천히 걸으세요.", nextDate: { place: "동성로 '미라보양과자점'", reason: "예약해야만 맛볼 수 있는 프리미엄 디저트 코스입니다." } },
      "제주": { theme: "한림 에메랄드빛 바다 멍", vibe: ["#협재바다", "#금능포구", "#오션뷰"], doThis: ["협재 해수욕장 모래사장 맨발로 걷기", "금능해수욕장 야자수 아래서 인생샷", "한림항 근처 맛집 '우무' 푸딩 맛보기"], transportInfo: "제주 버스 202번 혹은 렌터카 주차는 협재 공영주차장을 이용하세요.", nextDate: { place: "제주 '스누피 가든'", reason: "미리 예매하면 줄 서지 않고 바로 입장 가능해요!" } },
      "부산": { theme: "해운대 달맞이길 로맨틱 로드", vibe: ["#해운대야경", "#달맞이길", "#바다전망"], doThis: ["해운대 해변 열차 타고 미포에서 청사포까지", "달맞이길 '카페 반'에서 바다 조망", "더베이101에서 마린시티 야경 감상"], transportInfo: "중동역에서 마을버스를 타거나 택시 기본요금 거리에요.", nextDate: { place: "광안리 '요트투어'", reason: "일몰 시간대는 일주일 전 예약이 필수입니다." } }
    };

    const chosen = REGION_FALLBACKS[condition.지역] || {
      theme: "우리동네 숨은 힙플 찾기",
      vibe: ["#동네탐험", "#숨은맛집", "#소소한행복"],
      doThis: ["지역에서 가장 오래된 서점 방문하기", "평점이 가장 높은 로컬 카페 탐방", "야경이 예쁜 근처 산책길 걷기"],
      transportInfo: "대중교통보다는 가벼운 도보 이동을 추천합니다.",
      nextDate: { place: "인기 워크숍 공방", reason: "나만의 향수나 도자기를 만드는 프라이빗한 시간을 미리 예약하세요." }
    };

    return NextResponse.json({
      ...chosen,
      talkTopic: "우리 오늘 간 곳 중에 어디가 가장 힙했어?",
      randomTwist: "가장 맘에 드는 장소에서 서로 10초 동안 모델처럼 포즈 잡기!",
      perfectFor: "새로운 공간의 매력을 발견하고 싶은 커플"
    });
  }
}
