import { NextResponse } from "next/server";

export const runtime = "edge";

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
    const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=50&contentTypeId=15&arrange=Q`;
    const res = await fetch(url);
    const d = await res.json();
    const items = d?.response?.body?.items?.item || [];
    return NextResponse.json({ festivals: Array.isArray(items) ? items : [items] }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { taste, condition } = body;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    const prompt = `
      당신은 MZ 트렌드를 이끄는 힙한 데이트 디렉터입니다. 
      지역(${condition.지역}), 취향(${taste.무드}, ${taste.활동}), 예산(${condition.예산}) 기반.
      인스타 핫플, 힙한 감성 공간 위주의 3단계 코스를 짜주세요.
      
      주의사항:
      1. 텍스트에 '**'와 같은 강조 표시(마크다운 볼드체)를 절대 사용하지 마세요.
      2. '성수동' 등 특정 지역명을 예시로 언급하지 마세요.
      3. 커플, 연인 단어 사용 금지.
      
      반드시 아래 JSON 형식으로만 응답하세요:
      {
        "theme": "코스 제목",
        "emoji": "이모지",
        "vibe": ["#해시태그1", "#해시태그2"],
        "desc": "한 줄 감성",
        "doThis": ["활동1", "활동2", "활동3"],
        "transportInfo": "이동 팁",
        "talkTopic": "대화 주제",
        "randomTwist": "미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음 추천", "reason": "이유", "emoji": "이모지" }
      }
    `;
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message || "AI Error" }, { status: res.status, headers: corsHeaders });

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let finalJson = jsonMatch ? jsonMatch[0] : text;
    
    // 최종 텍스트에서 ** 제거 (안전장치)
    finalJson = finalJson.replace(/\*\*/g, "");
    
    return NextResponse.json(JSON.parse(finalJson), { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: "새로운 감성을 충전 중입니다. 다시 시도해주세요!" }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
