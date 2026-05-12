import { NextResponse } from "next/server";

const AREA_CODES: Record<string, string> = {
  "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
  "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET(request: Request) {
  const tourKey = process.env.TOUR_API_KEY || "";
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "";
  const areaCode = AREA_CODES[region] || "";

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  };

  try {
    const baseUrl = "https://apis.data.go.kr/B551011/KorService1/areaBasedList1";
    const query = `?serviceKey=${encodeURIComponent(tourKey)}&numOfRows=30&pageNo=1&MobileOS=ETC&MobileApp=anyplan&_type=json&contentTypeId=15&areaCode=${areaCode}&arrange=A`;
    const res = await fetch(baseUrl + query, { headers });
    const data = await res.json();
    return NextResponse.json({ festivals: data?.response?.body?.items?.item || [], trails: [] }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ festivals: [], trails: [] }, { headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profile, taste, condition } = body;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 모델명을 gemini-1.5-flash로 수정 (2.5는 오타임)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const prompt = `당신은 로컬 문화 경험 큐레이터입니다. 다음 정보를 바탕으로 [감성적 묘사] [장소명]에서 형식의 테마를 제안하세요. 반드시 JSON으로만 답변하세요.
    - 지역: ${condition.지역}, 동행: ${profile.myAge}대와 ${profile.partnerAge}대, 취향: ${taste.무드.join(", ")}
    - 출력 형식: {"theme": "", "desc": "", "emoji": "", "vibe": [], "doThis": [{"title": "", "desc": ""}], "funTip": "", "randomTwist": "", "talkTopic": "", "nearby": []}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    
    return NextResponse.json(cleanJson, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: "생성 실패" }, { status: 200, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
