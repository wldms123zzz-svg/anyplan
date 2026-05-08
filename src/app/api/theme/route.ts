import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let currentRegion = "전국";
  
  try {
    const body = await req.json();
    const { profile, taste, condition } = body;
    currentRegion = condition.지역 || "전국";
    
    const apiKey = process.env.GEMINI_API_KEY;
    const tourKey = process.env.TOUR_API_KEY;

    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    let realData = "";
    let workshopData = "";

    const AREA_CODES: Record<string, string> = {
      "서울": "11", "인천": "28", "대전": "30", "대구": "27", "광주": "29", "부산": "26", "울산": "31", "세종": "36",
      "경기": "41", "강원": "42", "충북": "43", "충남": "44", "전북": "45", "전남": "46", "경북": "47", "경남": "48", "제주": "50"
    };
    const regnCd = AREA_CODES[currentRegion] || "";

    if (tourKey && regnCd) {
      try {
        const fetchItems = async (url: string) => {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            const items = data?.response?.body?.items?.item;
            return items ? (Array.isArray(items) ? items : [items]) : [];
          } catch (e) { return []; }
        };

        const targetYear = "2026";
        const targetMonth = String(new Date().getMonth() + 1).padStart(2, "0");
        
        const [festItems, areaItems, craftItems] = await Promise.all([
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonth}01&lDongRegnCd=${regnCd}&numOfRows=10`),
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&lDongRegnCd=${regnCd}&numOfRows=10&arrange=Q`),
          taste.활동.includes("만들기") 
            ? fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(currentRegion + " 공방 원데이클래스")}&numOfRows=10`)
            : Promise.resolve([])
        ]);

        const combined = [...festItems, ...areaItems].filter(i => i && i.title);
        if (combined.length > 0) {
          realData = combined.sort(() => 0.5 - Math.random()).slice(0, 10).map((i: any) => `${i.title}(${i.addr1 || ""})`).join(", ");
        }
        if (craftItems?.length > 0) {
          workshopData = craftItems.map((i: any) => `${i.title}(공방: ${i.addr1 || ""})`).join(", ");
        }
      } catch (e) {}
    }

    const prompt = `
      당신은 대한민국 최고의 '지역 큐레이터'입니다.
      지역: ${currentRegion}
      취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
      실시간 장소 데이터: ${realData || "해당 지역 명소"}
      공방 데이터: ${workshopData || "없음"}

      [특별 미션: 심플한 3단계 코스 설계]
      1. 추천 활동은 딱 **3가지**만 제안하세요. (doThis 배열 길이는 반드시 3이어야 함)
      2. 3가지 활동 중 최소 **하나 이상**은 반드시 제공된 '실시간 장소 데이터'나 '공방 데이터'에 있는 **실제 장소 명칭**을 포함해야 합니다.
      3. 주변의 숨은 맛집, 팝업 스토어, 전시회 등을 실제 장소 기반으로 추천하세요.

      [필수 사항]
      - '커플', '연인', '데이트' 단어 절대 금지. '우리', '함께하는 이' 등으로 표현.
      - 수필처럼 감성적이고 아주 구체적인 문장으로 작성.
      - 매번 다른 장소를 선정하여 랜덤성을 보여주세요.

      반드시 아래 JSON 형식으로만 응답하세요:
      {
        "theme": "테마 제목",
        "emoji": "이모지",
        "vibe": ["#태그1", "#태그2"],
        "desc": "선정한 장소와 분위기에 대한 감성적인 소개",
        "doThis": [
          "1번 활동 (실제 장소 포함 가능)",
          "2번 활동 (실제 장소 포함 가능)",
          "3번 활동 (실제 장소 포함 가능)"
        ],
        "transportInfo": "도착 방법 및 주차 정보",
        "talkTopic": "오늘 나누면 좋을 깊은 대화 주제",
        "randomTwist": "오늘의 돌발 미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음에 가볼 만한 곳", "reason": "이유", "emoji": "이모지" }
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: 'no-store',
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0,
          response_mime_type: "application/json"
        }
      })
    });

    const data = await geminiRes.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    return NextResponse.json(JSON.parse(resultText.trim()));

  } catch (error: any) {
    return NextResponse.json({ 
      theme: `${currentRegion}에서의 짧고 짙은 시간`,
      emoji: "⏳",
      vibe: ["#심플코스", "#실제장소기반", "#밀도있는데이트"],
      desc: "잠시 데이터 연결이 원활하지 않아 완벽한 코스를 짜지 못했지만, 가끔은 복잡한 계획보다 실제 발길이 닿는 곳에서의 우연한 만남이 더 소중합니다.",
      doThis: [
        "가장 가까운 명소를 찾아 그곳의 공기를 천천히 들이마시기",
        "근처에 보이는 가장 오래된 식당에서 오늘의 첫 끼 즐기기",
        "마지막으로 고요한 카페에 들러 오늘 하루의 조각들을 정리하기"
      ],
      transportInfo: "가장 편안한 발걸음으로 이동하기",
      talkTopic: "오늘 우리에게 가장 필요했던 한 가지는 무엇이었을까?",
      randomTwist: "지금 눈앞에 보이는 풍경 중 가장 따뜻한 색깔 찾아보기",
      perfectFor: "가볍지만 진심을 나누고 싶은 날",
      nextDate: { place: "동네 작은 서점", reason: "조용한 마무리", emoji: "📚" }
    });
  }
}
