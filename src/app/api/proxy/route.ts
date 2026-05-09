import { NextResponse } from "next/server";

const AREA_CODES: Record<string, string> = {
  "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
  "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "";
  const month = searchParams.get("month") || "05";
  const tourKey = process.env.TOUR_API_KEY;
  const areaCode = AREA_CODES[region] || "";

  try {
    const targetMonth = month.padStart(2, "0");
    const dateStr = `${new Date().getFullYear()}${targetMonth}01`;

    const fetchItems = async (type: string) => {
      const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=50&contentTypeId=${type}&arrange=Q`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const d = await res.json();
      return d?.response?.body?.items?.item || [];
    };

    const [events, culture] = await Promise.all([fetchItems("15"), fetchItems("14")]);
    const combined = [...(Array.isArray(events) ? events : (events ? [events] : [])), ...(Array.isArray(culture) ? culture : (culture ? [culture] : []))].filter(i => i && i.title);

    return NextResponse.json({ festivals: combined }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, taste, condition } = body;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    const prompt = `데이트 코스 추천: 지역(${condition.지역}), 취향(${taste.무드}, ${taste.활동}), 예산(${condition.예산}). 음악 선택시 콘서트 추천. 커플/연인 단어 금지. JSON 형식 응답. { "theme": "...", "emoji": "...", "vibe": [], "desc": "...", "doThis": [], "transportInfo": "...", "talkTopic": "...", "randomTwist": "...", "perfectFor": "...", "nextDate": { "place": "...", "reason": "...", "emoji": "..." } }`;
    
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await geminiRes.json();
    
    if (!geminiRes.ok) {
      return NextResponse.json({ error: data.error?.message || "Gemini API 에러" }, { status: geminiRes.status });
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    if (!text) {
      return NextResponse.json({ error: "AI 응답이 비어있습니다." }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(text), {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
