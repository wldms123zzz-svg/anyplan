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
      당신은 MZ세대의 트렌드를 꿰뚫고 있는 '힙한 데이트 디렉터'입니다. 
      지역(${condition.지역}), 취향(${taste.무드}, ${taste.활동}), 예산(${condition.예산})을 바탕으로,
      인스타 핫플, 힙한 감성 공간, 사진이 잘 나오는 트렌디한 데이트 코스를 3단계로 짜주세요.
      
      지침:
      1. 성수, 한남, 압구정 느낌의 '힙한 감성'이 묻어나는 장소와 활동을 추천하세요.
      2. '인스타 핫플'이나 '팝업 스토어', '감성 전시' 등을 적극 포함하세요.
      3. 'talkTopic'은 요즘 유행하는 밈이나 흥미로운 심리 대화 위주로 구성하세요.
      4. 'randomTwist'는 인스타 스토리에 올리기 좋은 신박한 챌린지나 미션이어야 합니다.
      5. 커플, 연인 단어 사용 금지.
      
      반드시 아래 JSON 형식으로만 응답하세요:
      {
        "theme": "코스 제목 (힙하고 센스있게)",
        "emoji": "이모지",
        "vibe": ["#인스타핫플", "#힙한감성", "#사진맛집"],
        "desc": "요즘 가장 핫한 데이트 바이브",
        "doThis": ["힙한 활동1", "힙한 활동2", "힙한 활동3"],
        "transportInfo": "이동 팁",
        "talkTopic": "힙한 대화 주제",
        "randomTwist": "인스타용 미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음 핫플 추천", "reason": "이유", "emoji": "이모지" }
      }
    `;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error?.message || "AI Error" }, { status: res.status, headers: corsHeaders });

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    return NextResponse.json(JSON.parse(jsonMatch ? jsonMatch[0] : text), { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: "현재 힙한 감성을 충전 중입니다. 잠시 후 다시 눌러주세요!" }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
