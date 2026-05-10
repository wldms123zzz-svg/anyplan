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

  // 1. 브라우저인 것처럼 속이기 위한 헤더
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  };

  try {
    // 2. 서비스 키를 맨 앞에 배치 (일부 공공데이터 API 필수 조건)
    const baseUrl = "http://apis.data.go.kr/B551011/KorService1/areaBasedList";
    const query = `?serviceKey=${tourKey}&numOfRows=30&pageNo=1&MobileOS=ETC&MobileApp=anyplan&_type=json&contentTypeId=15&areaCode=${areaCode}&arrange=A`;
    const tourUrl = baseUrl + query;

    console.log("Attempting KorService1 call...");

    const res = await fetch(tourUrl, { headers });
    const text = await res.text();

    if (text.includes("Unexpected errors")) {
      // 3. 만약 실패하면 KorService2로 다시 시도 (주소 형식 변경)
      const v2Url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=30&contentTypeId=15`;
      const res2 = await fetch(v2Url, { headers });
      const text2 = await res2.text();
      
      if (text2.includes("Unexpected errors")) {
        throw new Error(`모든 API 버전에서 거부되었습니다: ${text2.slice(0, 50)}`);
      }
      
      const data2 = JSON.parse(text2);
      return NextResponse.json({ festivals: data2?.response?.body?.items?.item || [], trails: [] }, { headers: corsHeaders });
    }

    const data = JSON.parse(text);
    return NextResponse.json({ 
      festivals: data?.response?.body?.items?.item || [],
      trails: [] 
    }, { headers: corsHeaders });

  } catch (e: any) {
    return NextResponse.json({ 
      error: "관광공사 서버 최종 거부", 
      details: e.message 
    }, { status: 200, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, taste, condition, trails } = body;
  const geminiKey = process.env.GEMINI_API_KEY;

  try {
    const prompt = `당신은 사용자가 "기억하게 될 하루의 감정과 장면"을 설계하는 로컬 문화 경험 큐레이터입니다.
절대 장소를 단순 나열하지 마세요. "어떤 분위기와 감정을 경험하게 되는가"를 중심으로 구성하세요.

[핵심 원칙]
1. 체력 기반 설계: 사용자의 체력 상태(${condition.체력})를 최우선으로 고려하세요.
   - '종이인형': 최대한 걷지 않는 동선, 찜질방, 목욕탕, 고요한 숲 걷기, 좌식 카페 등 '힐링과 회복' 중심.
   - '보통': 적절한 산책과 휴식의 밸런스.
   - '에너자이저': 활동적인 체험, 긴 산책로, 전망대 등 '에너지 발산' 중심.
2. 이색 경험의 변주: 가끔은 '합천 영상테마파크', '경비행장', '이색 공방', '심야 책방' 등 평범하지 않은 로컬의 독특한 장소를 포함하세요.
3. 장면 중심 묘사 및 감각 활용: 빛, 바람, 소리, 질감 등을 활용해 영화처럼 묘사하세요.
4. 예약 정보: 예약이 필수인 장소가 포함될 경우 'nextTheme' 섹션에 해당 정보를 명시하세요.

[입력 정보]
- 지역: ${condition.지역}
- 체력 상태: ${condition.체력}
- 동행: ${profile.myAge}대와 ${profile.partnerAge}대
- 취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
- 로컬 산책 데이터: ${JSON.stringify(trails?.slice(0, 3))}

[출력 형식 (JSON 전용)]
{
  "theme": "영화 제목 같은 테마 이름",
  "desc": "그날의 분위기를 설명하는 한 줄",
  "emoji": "분위기 아이콘",
  "vibe": ["#키워드1", "#키워드2", "#키워드3"],
  "doThis": [
    {
      "title": "공간+행동 제목",
      "desc": "감각적이고 구체적인 장면 묘사 (체력 상태 반영)"
    }
  ],
  "duration": "예상 시간",
  "bestTime": "추천 시간대",
  "transportInfo": "이동/주차 팁",
  "talkTopic": "분위기에 어울리는 대화 주제",
  "randomTwist": "그날의 특별한 미션",
  "nearby": [
    { "name": "장소명", "type": "음식점/카페/관광", "reason": "추천 이유", "emoji": "아이콘" }
  ],
  "nextTheme": {
    "title": "다음에 추천하는 테마",
    "desc": "테마 설명",
    "isReservationRequired": true/false
  }
}

반드시 JSON 객체만 반환하세요.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let cleanText = jsonMatch ? jsonMatch[0] : text;
    
    return NextResponse.json(JSON.parse(cleanText), { headers: corsHeaders });
  } catch (e: any) {
    console.error("Gemini POST Error:", e);
    return NextResponse.json({ error: "테마를 생성하는 중 오류가 발생했습니다." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
