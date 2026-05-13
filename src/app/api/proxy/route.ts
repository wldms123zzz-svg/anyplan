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
    const { profile = {}, taste = {}, condition = {} } = body;
    const geminiKey = process.env.GEMINI_API_KEY;

    // 모델명을 최신 정식 버전으로 수정 (gemini-1.5-flash 권장)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    // 프론트엔드 데이터 구조와 동기화 (무드, 활동, 체력 등)
    const myAge = profile.myAge || "20";
    const partnerAge = profile.partnerAge || "20";
    const region = condition.지역 || "전국";
    const stamina = condition.체력 || "보통";
    const budget = condition.예산 || "적당히";
    const mood = Array.isArray(taste.무드) ? taste.무드.join(", ") : "";
    const activity = Array.isArray(taste.활동) ? taste.활동.join(", ") : "";

    const prompt = `당신은 사용자가 "기억하게 될 하루의 감정과 장면"을 설계하는 로컬 문화 경험 큐레이터입니다.

[테마 제목 규칙]
- 제목은 반드시 "[감성적인 묘사] [장소명]에서" 형식으로 간결하게 작성하세요.
- 예시: "오래된 영화 같은 합천영상테마파크에서"

[핵심 설계 원칙]
1. 능동적 동사 사용: '보기' 대신 '내기하기', '찍어주기', '만들기' 등 상호작용 동사를 사용하세요.
2. 구체적 장소명: 인근의 실제 존재할 법한 구체적인 장소명을 포함하세요.

[입력 정보]
- 지역: ${region}, 체력: ${stamina}, 예산: ${budget}
- 동행: ${myAge}대와 ${partnerAge}대, 취향: ${mood}, ${activity}

[출력 형식 (JSON)]
반드시 다음 구조의 JSON 객체만 반환하세요:
{
  "theme": "[감성적 묘사] [장소명]에서",
  "desc": "그날의 분위기를 설명하는 한 줄",
  "emoji": "아이콘",
  "vibe": ["#키워드1", "#키워드2"],
  "doThis": [
    { "title": "첫 번째 장면", "desc": "01 [구체적이고 능동적인 행동]" },
    { "title": "두 번째 장면", "desc": "02 [커플 상호작용/내기/놀이]" },
    { "title": "자리를 옮겨서", "desc": "03 인근의 '[구체적 장소명]'으로 이동하여, [마무리 활동]" }
  ],
  "funTip": "더 재밌게 즐기는 법",
  "randomTwist": "여기에 이걸 추가하면 더 재밌어짐! (엉뚱한 아이디어)",
  "talkTopic": "나누기 좋은 질문",
  "nearby": [
    { "name": "장소이름", "type": "카페/식당/명소", "reason": "추천 이유", "emoji": "아이콘" }
  ],
  "nextTheme": { "title": "다음 추천 테마", "desc": "간략한 설명", "isReservationRequired": false },
  "duration": "약 4시간",
  "bestTime": "오후 무렵"
}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    
    if (!cleanJson.theme) {
        throw new Error("유효하지 않은 구조의 응답 도출");
    }

    return NextResponse.json(cleanJson, { headers: corsHeaders });
  } catch (e: any) {
    console.error("AI Generation Error:", e);
    return NextResponse.json({ error: "생성 실패", details: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
