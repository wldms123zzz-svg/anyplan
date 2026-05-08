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
          realData = combined.sort(() => 0.5 - Math.random()).slice(0, 8).map((i: any) => `${i.title}(${i.addr1 || ""})`).join(", ");
        }
        if (craftItems?.length > 0) {
          workshopData = craftItems.map((i: any) => `${i.title}(공방: ${i.addr1 || ""})`).join(", ");
        }
      } catch (e) {}
    }

    const prompt = `
      당신은 대한민국 최고의 '지역 힙스터 데이트 플래너'입니다.
      지역: ${currentRegion}
      취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
      예산: ${condition.예산}
      실시간 장소 데이터: ${realData || "해당 지역의 실제 명소 사용"}
      공방 데이터: ${workshopData || "없음"}

      [특별 미션]
      **이번에는 여러 곳을 돌아다니는 대신, 가장 매력적인 '장소 한 군데'를 딱 정해서 그 안에서(혹은 그 근처에서) 즐길 수 있는 5단계 코스를 짜주세요.**
      예를 들어, 특정 공방이나 전시회, 혹은 커다란 공원 한 곳에서 할 수 있는 구체적인 활동들을 순차적으로 제안하세요.

      [필수 사항]
      1. '커플', '연인', '데이트' 단어 절대 금지. '우리', '함께하는 이' 등으로 표현.
      2. '만들기' 포함 시 제공된 공방 데이터 중 하나를 골라 그곳에서의 시간을 상세히 묘사.
      3. 수필처럼 감성적이고 아주 구체적인 문장 사용.
      4. 매번 다른 장소를 선정하여 랜덤성을 극대화하세요.

      반드시 아래 JSON 형식으로만 응답하세요:
      {
        "theme": "테마 제목",
        "emoji": "이모지",
        "vibe": ["#태그1", "#태그2"],
        "desc": "한 장소에 집중한 이유와 감성적인 설명",
        "doThis": ["활동1 (한 장소 내에서)", "활동2", "활동3", "활동4", "활동5"],
        "transportInfo": "도착 방법 및 주차",
        "talkTopic": "그 장소에서 나눌 대화 주제",
        "randomTwist": "그곳에서만 할 수 있는 돌발 미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음에 갈 장소", "reason": "이유", "emoji": "이모지" }
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
      theme: `${currentRegion}의 한 조각`,
      emoji: "📍",
      vibe: ["#한곳에머물기", "#깊은대화", "#우리만의공간"],
      desc: "잠시 데이터 연결이 원활하지 않아 AI가 코스를 완성하지 못했습니다. 하지만 가끔은 정해진 곳 없이 한 장소에 오래 머물며 서로에게 집중하는 시간도 필요한 법이죠.",
      doThis: ["근처 가장 마음에 드는 카페 한 곳 정하기", "서로의 첫인상에 대해 길게 이야기하기", "오늘의 공기와 분위기를 그림으로 남겨보기", "상대방이 좋아하는 노래 같이 들어보기", "다음에 함께 오고 싶은 곳 약속하기"],
      transportInfo: "가장 편한 방법으로 이동하기",
      talkTopic: "이곳에 우리 둘만 있다면 넌 어떤 기분일 것 같아?",
      randomTwist: "지금 눈에 보이는 가장 예쁜 사물 하나 사진 찍어주기",
      perfectFor: "천천히 서로를 알아가고 싶은 날",
      nextDate: { place: "조용한 독립서점", reason: "이후의 대화", emoji: "📚" }
    });
  }
}
