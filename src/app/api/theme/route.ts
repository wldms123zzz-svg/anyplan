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
      이동수단: ${condition.이동수단} (매우 중요)
      실시간 장소 데이터: ${realData || "해당 지역 명소"}
      공방 데이터: ${workshopData || "없음"}

      [미션: 간결하고 구체적인 3단계 코스]
      1. 활동은 딱 **3가지**만 제안하세요. (doThis 배열 길이는 반드시 3)
      2. 문장은 아주 **간결하고 명확하게** 쓰세요. (예: "1. 00장소 관람하기")
      3. 최소 한 곳은 반드시 실제 장소(명소, 공방, 축제 등)를 포함하세요.
      4. 이동수단(${condition.이동수단})에 따라 **transportInfo**를 다르게 제공하세요:
         - '뚜벅이' 선택 시: 가장 가까운 **지하철역**이나 버스 정류장, 도보 이동 팁 제공.
         - '자차' 선택 시: 가장 가까운 **공영 주차장**이나 주차 팁 제공.

      [금지 사항]
      - '커플', '연인', '데이트' 단어 사용 금지. '우리', '함께' 등으로 표현.
      - 불필요하게 긴 미사여구 생략.

      반드시 아래 JSON 형식으로 응답하세요:
      {
        "theme": "테마 제목",
        "emoji": "이모지",
        "vibe": ["#태그1", "#태그2"],
        "desc": "선정한 장소의 감성적인 소개 (짧게)",
        "doThis": [
          "1번 활동 (실제 장소 포함)",
          "2번 활동",
          "3번 활동"
        ],
        "transportInfo": "이동수단 맞춤 정보 (지하철/주차장 등)",
        "talkTopic": "나눌 대화 주제",
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
      vibe: ["#심플코스", "#맞춤정보"],
      desc: "잠시 연결이 원활하지 않아 간략한 코스를 준비했습니다.",
      doThis: [
        "가장 마음에 드는 명소 한 곳 방문하기",
        "근처 맛집에서 맛있는 식사 즐기기",
        "조용한 카페에서 하루 마무리하기"
      ],
      transportInfo: condition.이동수단?.includes("뚜벅이") ? "가까운 지하철역을 이용해 보세요." : "인근 공영 주차장을 확인해 보세요.",
      talkTopic: "오늘 가장 즐거웠던 순간은?",
      randomTwist: "상대방 사진 한 장 찍어주기",
      perfectFor: "가볍게 산책하고 싶은 날",
      nextDate: { place: "동네 작은 서점", reason: "조용한 마무리", emoji: "📚" }
    });
  }
}
