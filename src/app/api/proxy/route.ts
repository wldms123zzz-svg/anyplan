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
절대 장소를 단순 나열하거나 범위를 넓게 잡지 마세요. 

[핵심 설계 원칙]
1. 원 스팟 중심 설계: 해당 지역에서 가장 분위기 있는 '하나의 구체적인 로컬 스팟'을 먼저 선정하고, 그 공간의 안과 밖에서 벌어지는 장면들을 중심으로 코스를 짜세요.
2. 장면 중심 묘사: "공간의 분위기(오래된 골목, 노을 등) + 구체적 행동 + 감각 요소(빛, 바람, 냄새 등)"가 결합된 장면을 설계하세요.
3. 구체적 행동 지시 (필수): 
   - '서로의 핸드폰 카메라를 클래식 필름 모드로 맞추고 사진 찍기'
   - '돗자리 대신 겉옷을 깔고 누워 구름 바라보기'
   - '파도 소리를 들으며 5분 동안 아무 말 없이 걷기'
   - 'LP 음악이 흐르는 공간에서 서로 한 곡씩 추천하기'
   처럼 사용자가 바로 실행할 수 있는 아주 디테일한 행동을 2~3문장으로 묘사하세요.
4. 체력 기반 설계: ${condition.체력} 상태를 반영하여 동선을 최소화하거나 활동성을 조절하세요.

[문체 규칙]
- 관광앱/SNS 광고 문체 절대 금지 (핫플, 인생샷, 감성 맛집 등 사용 불가).
- 조용하고 영화적인 톤 유지.

[입력 정보]
- 지역: ${condition.지역}
- 체력: ${condition.체력}
- 동행: ${profile.myAge}대와 ${profile.partnerAge}대
- 취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}

[출력 형식 (JSON)]
{
  "theme": "스팟의 이름이 드러나는 영화 제목 같은 테마",
  "desc": "그날의 공기와 장면을 설명하는 한 줄",
  "emoji": "아이콘",
  "vibe": ["#키워드1", "#키워드2", "#키워드3"],
  "doThis": [
    {
      "title": "장소와 장면의 구체적 이름",
      "desc": "공간의 질감과 디테일한 행동이 포함된 영화적 설명"
    }
  ],
  "duration": "소요 시간",
  "bestTime": "추천 시간대",
  "transportInfo": "이동/주차 팁",
  "talkTopic": "그 장소에서 나누기 좋은 깊은 질문",
  "randomTwist": "그날을 완성할 작고 감각적인 미션",
  "nearby": [{ "name": "장소명", "type": "카페/음식점", "reason": "이유", "emoji": "아이콘" }],
  "nextTheme": { "title": "다음 테마", "desc": "설명", "isReservationRequired": true/false }
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
