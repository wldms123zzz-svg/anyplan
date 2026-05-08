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
      You are a Date Planner for ${currentRegion}, South Korea.
      User Mood: ${taste.무드.join(", ")}
      User Activity: ${taste.활동.join(", ")}
      Budget: ${condition.예산}
      Real Local Data: ${realData || "Use your knowledge"}
      Workshop Data: ${workshopData || "None"}

      Create a detailed 5-step date course. 
      NEVER use the words "couple" or "date" (연인, 데이트). Use "us" or "we".
      If "만들기" is selected, include a workshop from the data.
      Randomly pick different places every time.

      Output MUST be a single JSON object with this exact structure:
      {
        "theme": "Title",
        "emoji": "Emoji",
        "vibe": ["#tag1", "#tag2"],
        "desc": "Long emotional description",
        "doThis": ["Step1", "Step2", "Step3", "Step4", "Step5"],
        "transportInfo": "Traffic info",
        "talkTopic": "Question",
        "randomTwist": "Mission",
        "perfectFor": "Target",
        "nextDate": { "place": "Next place", "reason": "Reason", "emoji": "Emoji" }
      }
    `;

    // 2026년 기준 가장 안정적인 2.5 Flash 모델 사용
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
      theme: `${currentRegion}의 선물 같은 하루`,
      emoji: "🎁",
      vibe: ["#기대", "#설렘", "#우리만의시간"],
      desc: "잠시 데이터 연결이 원활하지 않아 AI가 완벽한 코스를 짜지 못했지만, 오히려 계획 없는 발걸음이 더 아름다운 조각을 만들어낼지도 모릅니다. 지금 눈앞에 보이는 가장 예쁜 길을 따라 걸어보는 건 어떨까요?",
      doThis: ["가장 예쁜 길 따라 걷기", "근처 카페 방문하기", "서로의 사진 찍어주기", "오늘의 기분 나누기", "함께 있는 순간 즐기기"],
      transportInfo: "천천히 걷기",
      talkTopic: "오늘 우리에게 가장 필요했던 건 뭘까?",
      randomTwist: "지금 보이는 꽃 하나 골라주기",
      perfectFor: "함께라서 행복한 오늘",
      nextDate: { place: "동네 작은 독립서점", reason: "조용한 대화", emoji: "📚" }
    });
  }
}
