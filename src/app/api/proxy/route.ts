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
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "";
  const tourKey = process.env.TOUR_API_KEY;
  const areaCode = AREA_CODES[region] || "";

  try {
    const fetchItems = async (type: string) => {
      const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=50&contentTypeId=${type}&arrange=Q`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const d = await res.json();
      return d?.response?.body?.items?.item || [];
    };

    const [events, culture] = await Promise.all([fetchItems("15"), fetchItems("14")]);
    const combined = [...(Array.isArray(events) ? events : [events]), ...(Array.isArray(culture) ? culture : [culture])].filter(i => i && i.title);

    return NextResponse.json({ festivals: combined }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { taste, condition } = body;
  const geminiKey = process.env.GEMINI_API_KEY;

  const models = ["gemini-2.0-flash", "gemini-pro-latest", "gemini-flash-latest"];
  
  for (const model of models) {
    try {
      const prompt = `데이트 코스 추천: 지역(${condition.지역}), 취향(${taste.무드}, ${taste.활동}), 예산(${condition.예산}). 음악 선택시 콘서트 추천. 커플/연인 단어 금지. JSON 형식 응답.`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (!res.ok) continue; // 다음 모델로 재시도

      const data = await res.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return NextResponse.json(JSON.parse(jsonMatch[0]), { headers: corsHeaders });
      }
    } catch (e) {
      console.error(`Model ${model} failed`, e);
    }
  }

  return NextResponse.json({ error: "모든 AI 모델이 응답에 실패했습니다." }, { status: 500, headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
