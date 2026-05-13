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
    const { profile = {}, taste = {}, condition = {}, festivals = [] } = body;
    const geminiKey = process.env.GEMINI_API_KEY;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const myAge = profile.myAge || "20";
    const partnerAge = profile.partnerAge || "20";
    const region = condition.지역 || "전국";
    const stamina = condition.체력 || "보통";
    const budget = condition.예산 || "적당히";
    const mood = Array.isArray(taste.무드) ? taste.무드.join(", ") : "";
    const activity = Array.isArray(taste.활동) ? taste.활동.join(", ") : "";

    const festivalInfo = Array.isArray(festivals) && festivals.length > 0 
      ? `현재 지역 축제/이벤트 정보: ${festivals.map((f: any) => `${f.title}(${f.addr1 || ""})`).join(", ")}`
      : "";

    // 매번 다른 결과를 얻기 위한 랜덤성 부여 (시드용 타임스탬프)
    const randomSeed = Date.now();

    const prompt = `당신은 사용자가 "기억하게 될 하루의 감정과 장면"을 설계하는 로컬 문화 경험 큐레이터입니다.
    현재 요청의 고유 ID: ${randomSeed} (이 ID를 바탕으로 매번 절대 겹치지 않는 새로운 테마를 제안하세요)

[핵심 미션]
1. 창의성과 다양성: 기존의 뻔한 데이트 코스가 아닌, 기발하고 독특한 테마를 우선순위로 두세요.
2. 능동적 액션(Action): 커플/친구끼리 즐길 수 있는 내기, 미션, 게임 요소를 반드시 포함하세요. (예: "가장 예쁜 낙엽 찾아오기 내기", "1분 동안 서로의 눈만 보고 웃음 참기")
3. 축제 활용: ${festivalInfo ? "제시된 실제 축제 정보를 코스의 메인 또는 서브 테마로 적극 반영하세요." : "지역의 특색 있는 장소를 기반으로 가상의 팝업스토어나 전시가 열린 것처럼 상상력을 발휘해도 좋습니다."}

[테마 제목 규칙]
- 제목은 반드시 "[감성적인 묘사] [장소명]에서" 형식으로 작성하세요.

[입력 정보]
- 지역: ${region}, 체력: ${stamina}, 예산: ${budget}
- 동행: ${myAge}대와 ${partnerAge}대, 취향: ${mood}, ${activity}
${festivalInfo}

[출력 형식 (JSON)]
{
  "theme": "[감성적 묘사] [장소명]에서",
  "desc": "그날의 분위기를 설명하는 한 줄",
  "emoji": "아이콘",
  "vibe": ["#내기", "#미션", "#유니크"],
  "doThis": [
    { "title": "장면 1: 시작", "desc": "01 [구체적인 내기나 첫 번째 행동]" },
    { "title": "장면 2: 몰입", "desc": "02 [함께 수행할 미션이나 상호작용]" },
    { "title": "장면 3: 여운", "desc": "03 [장소를 옮겨 수행할 마무리 활동]" }
  ],
  "funTip": "재미를 더할 꿀팁",
  "randomTwist": "이걸 더하면 더 재밌어짐! (엉뚱한 아이디어)",
  "talkTopic": "나누기 좋은 질문",
  "nearby": [
    { "name": "장소명", "type": "카페/식당/명소", "reason": "추천 이유", "emoji": "아이콘" }
  ],
  "nextTheme": { "title": "다음 추천 테마", "desc": "설명", "isReservationRequired": false },
  "duration": "소요 시간",
  "bestTime": "추천 시간대"
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
    
    if (!cleanJson.theme) throw new Error("유효하지 않은 응답");

    return NextResponse.json(cleanJson, { headers: corsHeaders });
  } catch (e: any) {
    console.error("AI Error:", e);
    return NextResponse.json({ error: "생성 실패", details: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
