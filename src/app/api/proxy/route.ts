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
  const tourKey = process.env.TOUR_API_KEY;
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "";
  const areaCode = AREA_CODES[region] || "";

  // 기본적인 응답 테스트를 위해 로그 추가
  console.log("Request received for region:", region);

  try {
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=30&contentTypeId=15&arrange=Q`;
    const durunubiUrl = `https://apis.data.go.kr/B551011/DurunubiService/courseList?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&numOfRows=20&pageNo=1`;

    const responses = await Promise.all([
      fetch(tourUrl),
      fetch(durunubiUrl)
    ]);

    const results = await Promise.all(responses.map(async (res) => {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`응답이 JSON이 아닙니다: ${text.slice(0, 100)}`);
      }
    }));

    return NextResponse.json({ 
      festivals: results[0]?.response?.body?.items?.item || [],
      trails: results[1]?.response?.body?.items?.item || []
    }, { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ 
      error: "백엔드 호출 실패", 
      details: e.message 
    }, { status: 200, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { taste, condition, trails } = body;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    const prompt = `
      당신은 MZ 힙한 데이트 디렉터입니다.
      지역(${condition.지역}), 취향(${taste.무드}, ${taste.활동}), 이동수단(${condition.이동수단}) 기반.
      산책길 참고: ${JSON.stringify(trails?.slice(0, 5))}
      
      지침:
      1. 이동수단이 '뚜벅이'면 대중교통(지하철역, 출구 번호 등) 위주로 안내하세요.
      2. 이동수단이 '자차'면 주차장(무료/유료 주차장 명칭 및 팁) 정보를 필수 포함하세요.
      3. 두루누비 산책길 중 하나를 골라 코스에 힙하게 녹여내세요.
      4. 인스타 핫플 감성 유지. 강조 표시(**) 금지. 성수동 언급 금지.
      5. randomTwist(미션)은 단순히 '사진 찍기'가 아니라, '서로의 30초 초상화 그려주기', '가장 마음에 드는 소품 하나 사주기', '동네에서 가장 오래되어 보이는 간판 찾기', '특이한 모양의 나뭇잎 줍기' 등 구체적이고 활동적인 미션을 1개 제안하세요.
      
      JSON 응답:
      {
        "theme": "코스 제목",
        "emoji": "이모지",
        "vibe": ["#해시태그"],
        "desc": "한 줄 감성",
        "doThis": ["활동1", "활동2", "활동3"],
        "transportInfo": "대중교통 상세(출구번호 등) 혹은 주차장 상세 정보",
        "talkTopic": "대화 주제",
        "randomTwist": "구체적이고 재미있는 미션 (활동 위주)",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음 핫플", "reason": "이유", "emoji": "이모지" }
      }
    `;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let cleanText = jsonMatch ? jsonMatch[0] : text;
    cleanText = cleanText.replace(/\*\*/g, "");

    return NextResponse.json(JSON.parse(cleanText), { headers: corsHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: "연결 오류가 발생했습니다." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
