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
코스를 넓게 잡지 마세요. 하나의 구체적인 장소(Spot) 혹은 아주 좁은 골목길 하나를 선정하고, 그 안에서 사용자가 경험할 세밀한 장면들을 설계하세요.

[핵심 설계 원칙]
1. 단일 스팟 집중: 이동 거리를 최소화하고, 선택한 그 장소의 '구석구석'을 경험하게 하세요. (예: 공원 전체가 아니라 '공원의 서쪽 노을이 가장 잘 보이는 벤치 주변')
2. 행동의 초미세 설계: 사용자가 실제로 할 행동을 아주 디테일하게 지시하세요. 
   - 돗자리 대신 겉옷을 깔고 누워보기
   - 서로의 휴대폰을 클래식 필름 모드로 설정하고 10장만 찍어주기
   - 오래된 나무의 거친 질감을 손바닥으로 느껴보기
   - 이어폰 한 쪽씩 나눠 끼고 특정 곡을 들으며 3분간 침묵하기
3. 감각과 분위기의 결합: 선택한 장소의 빛, 공기, 냄새가 사용자의 행동과 어떻게 어우러지는지 묘사하세요.
4. 체력 상태 반영: ${condition.체력} 상태에 맞춰, 종이인형은 앉아서 즐기는 장면을, 에너자이저는 그 장소의 구석구석을 탐험하는 장면을 설계하세요.

[문체 및 금지 규칙]
- 관광앱/SNS 광고 문체(핫플, 인생샷 등) 절대 금지. 조용하고 밀도 있는 영화적 톤 유지.

[입력 정보]
- 지역: ${condition.지역}
- 동행: ${profile.myAge}대와 ${profile.partnerAge}대
- 취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
- 로컬 데이터: ${JSON.stringify(trails?.slice(0, 3))}

[출력 형식 (JSON)]
{
  "theme": "선정된 장소의 공기가 느껴지는 영화 제목 같은 이름",
  "desc": "그 장소에서 마주할 핵심적인 감각적 경험 한 줄",
  "emoji": "장소의 아이콘",
  "vibe": ["#장소명", "#핵심감각", "#행동키워드"],
  "doThis": [
    {
      "title": "장소의 특정 위치와 행동의 이름",
      "desc": "그 지점에서의 분위기, 구체적 행동, 감각 묘사가 결합된 밀도 높은 2~3문장"
    }
  ],
  "duration": "그곳에서 머무를 예상 시간",
  "bestTime": "그 장소가 가장 아름다운 시간대",
  "transportInfo": "해당 스팟으로 가는 법 및 근처 주차 팁",
  "talkTopic": "그 장소의 분위기에서만 나눌 수 있는 질문",
  "randomTwist": "그 장소의 숨겨진 매력을 찾는 아주 작은 미션",
  "nearby": [
    { "name": "근처 장소", "type": "카페/식당", "reason": "함께 들르기 좋은 이유", "emoji": "아이콘" }
  ],
  "nextTheme": {
    "title": "다음 스팟 추천",
    "desc": "연결되는 다른 분위기의 장소",
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
