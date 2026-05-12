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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    // 구조: 클라이언트 페이로드와 서버 참조 키값의 강제 동기화 및 예외 처리
    const myAge = profile.myAge || "20";
    const partnerAge = profile.partnerAge || "20";
    const region = condition.지역 || "전국"; // 프론트엔드에서 미전송 시 기본값 할당
    const energy = condition.에너지 || "";
    const budget = condition.예산 || "";
    const mood = Array.isArray(taste.분위기) ? taste.분위기.join(", ") : "";
    const activity = Array.isArray(taste.활동) ? taste.활동.join(", ") : "";

    const prompt = `당신은 로컬 문화 경험 큐레이터입니다. 다음 정보를 바탕으로 [감성적 묘사] [장소명]에서 형식의 테마를 제안하세요. 반드시 JSON으로만 답변하세요.
    - 조건: 지역(${region}), 에너지(${energy}), 예산(${budget})
    - 동행: ${myAge}대와 ${partnerAge}대
    - 취향: 분위기(${mood}), 활동(${activity})
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
    
    // 구조: AI 응답의 무결성 1차 검증
    if (!cleanJson.theme) {
        throw new Error("유효하지 않은 구조의 응답 도출");
    }

    return NextResponse.json(cleanJson, { headers: corsHeaders });
  } catch (e: any) {
    // 구조: 에러 발생 시 HTTP Status 500을 명시하여 프론트엔드의 !res.ok 조건문을 정상 작동시킴
    return NextResponse.json({ error: "생성 실패", details: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
