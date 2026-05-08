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

    if (tourKey && areaCode) {
      try {
        const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&areaCode=${areaCode}&numOfRows=20&arrange=Q`;
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
      당신은 대한민국 최고의 '힙스터 데이트 큐레이터'입니다. 
      평범한 공간도 힙하게 즐기는 법을 알고 있으며, 예약이 어려운 핫플레이스 정보에도 밝습니다.

      [핵심 요청]
      1. 오늘의 데이트: 사용자가 선택한 지역(${condition.지역})과 취향을 반영한 아주 힙하고 시적인 코스.
      2. 다음 데이트 예약: 해당 지역에서 가장 힙하지만 '예약'이 필수인 장소(맛집, 공방, 전시 등)를 별도로 추천하세요.

      [사용자 정보]
      지역: ${condition.지역}, 무드: ${taste.무드}, 활동: ${taste.활동}, 예산: ${condition.예산}
      에너지: 본인(${condition.상태}), 상대방(${condition.동행인상태})

      [현지 실시간 데이터]
      ${realData}

      [응답 형식 (JSON)]
      {
        "theme": "시적인 오늘의 테마 제목",
        "vibe": ["#해시태그1", "#해시태그2", "#해시태그3"],
        "desc": "3문장 이상의 감성적인 설명",
        "doThis": ["구체적인 1단계", "구체적인 2단계", "구체적인 3단계"],
        "transportInfo": "구체적인 버스/지하철/주차 팁",
        "talkTopic": "오늘의 대화 주제",
        "randomTwist": "더 재밌게 하려면? (힙한 미션)",
        "perfectFor": "이 코스가 딱인 커플 묘사",
        "nextDate": {
          "place": "예약이 필요한 힙한 장소명",
          "reason": "왜 다음 데이트로 추천하는지 (예약 팁 포함)",
          "emoji": "📅"
        }
      }

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
    
    return NextResponse.json({
      theme: "도심 속 숨겨진 아지트 탐험",
      emoji: "🕵️",
      vibe: ["#힙플레이스", "#나만아는곳", "#감성폭발"],
      desc: "평범한 골목 속에 숨어있는 보석 같은 공간을 찾아 떠나는 여행입니다. 익숙한 풍경도 오늘만큼은 특별하게 보일 거예요.",
      doThis: ["빈티지한 간판이 예쁜 가게 앞에서 서로 사진 찍어주기", "오래된 노포에서만 느낄 수 있는 깊은 맛 경험하기", "가장 힙한 독립 서점에서 서로에게 어울리는 책 선물하기"],
      transportInfo: "골목길이 좁으니 대중교통 이용 후 도보 이동을 추천합니다.",
      talkTopic: "우리가 처음 '힙하다'고 느꼈던 순간은 언제야?",
      randomTwist: "필름 카메라 앱으로 서로의 가장 자연스러운 모습 담아보기",
      perfectFor: "남들과 다른 우리만의 감성을 소중히 여기는 커플",
      nextDate: {
        place: "예약제 프라이빗 와인바",
        reason: "여기는 한 달 전 예약이 필수지만, 그만큼 가치가 있는 힙한 곳이에요. 다음 데이트를 위해 지금 확인해보세요!",
        emoji: "🍷"
      }
    });
  }
}
