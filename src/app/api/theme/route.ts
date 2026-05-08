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
      당신은 대한민국 최고의 '지역 힙스터 데이트 플래너'입니다. 지루한 설명 대신, 마치 한 편의 짧은 여행 수필 같은 몰입감을 선사하세요.

      지역: ${currentRegion}
      취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
      이동수단: ${condition.이동수단}
      실시간 장소 데이터: ${realData || "해당 지역의 상징적인 명소"}
      공방 데이터: ${workshopData || "없음"}

      [특별 미션: 3단계 로컬 서사 코스]
      1. 추천 활동은 딱 **3가지**만 제안하세요.
      2. **문체 스타일 (매우 중요)**: 
         - "01 [장소명]의 [분위기]를 배경으로 [구체적 활동]하며 [감성/대화 주제] 나누기" 형태의 서술형을 사용하세요.
         - 장소의 시각적인 묘사(에메랄드빛 바다, 쏟아지는 미디어 아트 등)를 풍부하게 섞으세요.
         - 제공된 '실시간 장소 데이터'나 '공방 데이터' 중 하나를 메인으로 활용하세요.
      3. 이동수단(${condition.이동수단})에 따라 **transportInfo**에 구체적인 정보를 담으세요:
         - 뚜벅이: 가장 가까운 역이나 버스 정류장 명칭 포함.
         - 자차: 정확한 주차장 팁 포함.

      [금지 사항]
      - '커플', '연인', '데이트' 단어 사용 금지. '우리', '함께' 등으로 표현.
      - 단순 나열식 문장 금지.

      JSON 응답 형식:
      {
        "theme": "테마 제목",
        "emoji": "이모지",
        "vibe": ["#태그1", "#태그2"],
        "desc": "이 코스를 선정한 이유 (수필 느낌의 한 문장)",
        "doThis": ["활동1 (서술형)", "활동2 (서술형)", "활동3 (서술형)"],
        "transportInfo": "교통/주차 정보",
        "talkTopic": "나눌 대화 주제",
        "randomTwist": "오늘의 돌발 미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음 장소", "reason": "이유", "emoji": "이모지" }
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
      theme: `${currentRegion}의 조각들`,
      emoji: "📍",
      vibe: ["#감성기록", "#우리만의공간"],
      desc: "잠시 데이터가 길을 잃었지만, 함께하는 발걸음만으로 충분히 아름다운 하루가 될 거예요.",
      doThis: [
        "근처 가장 오래된 가로수 아래를 걸으며 오늘 우리가 마주칠 우연한 기쁨들에 대해 속삭여보기",
        "눈에 띄는 작은 카페의 창가 자리에 앉아 흘러가는 풍경을 배경으로 서로의 첫인상을 그림처럼 기록하기",
        "하루의 끝, 가장 붉게 물든 노을을 함께 바라보며 다음에 다시 올 이곳의 계절을 약속하기"
      ],
      transportInfo: condition.이동수단?.includes("뚜벅이") ? "가장 가까운 역에서 천천히 걸어오세요." : "근처 공영 주차장을 이용해 보세요.",
      talkTopic: "오늘 우리를 웃게 만든 작은 것들",
      randomTwist: "상대방과 닮은 꽃 하나 찾아보기",
      perfectFor: "천천히 서로를 알아가고 싶은 날",
      nextDate: { place: "동네 독립서점", reason: "조용한 여운", emoji: "📚" }
    });
  }
}
