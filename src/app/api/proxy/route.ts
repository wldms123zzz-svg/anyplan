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
1. 관광앱 말투 금지: '핫플', '인생샷', '맛집 투어', '꼭 가봐야 할' 같은 SNS 광고형 표현은 절대 사용하지 마세요.
2. 장면 중심 묘사: "카페 방문하기" 대신 "철길 옆 폐건물을 개조한 카페에서 해 질 무렵 필름사진 찍기"처럼 사용자가 공간 안에 있는 것처럼 느껴지게 작성하세요.
3. 감각 묘사: 빛, 공기, 바람, 노을, 냄새, 파도소리, 질감, 시간의 흔적 등을 적극 활용하세요.
4. 구체적 행동 설계: "산책하기" 대신 "오래된 돌담길의 거친 질감을 손끝으로 느끼며 천천히 산책하기"처럼 디테일한 행동을 지시하세요.
5. 영화적 문체: 문장은 과장되지 않게, 조용하고 영화적인 분위기로 작성하세요. (단, 너무 오글거리지 않게)

[입력 정보]
- 지역: ${condition.지역}
- 동행: ${profile.myAge}대와 ${profile.partnerAge}대
- 취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
- 이동수단: ${condition.이동수단}
- 로컬 산책 데이터: ${JSON.stringify(trails?.slice(0, 3))}

[출력 형식 (JSON 전용)]
{
  "theme": "지역과 분위기가 드러나는 영화 제목 같은 이름",
  "desc": "그날 전체의 감정과 분위기를 설명하는 한 줄",
  "emoji": "분위기를 대변하는 아이콘",
  "vibe": ["#감성키워드1", "#감성키워드2", "#감성키워드3"],
  "doThis": [
    {
      "title": "공간과 행동이 결합된 제목",
      "desc": "공간 설명, 행동, 감각 묘사, 분위기가 포함된 영화적인 설명 (2~3문장)"
    }
  ],
  "transportInfo": "이동수단 추천 및 주차/출구 정보",
  "duration": "예상 소요 시간",
  "bestTime": "추천 시간대 (예: 해 질 무렵, 늦은 밤)",
  "talkTopic": "공간과 분위기에 어울리는 사유 깊은 대화 주제",
  "randomTwist": "그날의 감정을 완성할 구체적이고 감각적인 미션"
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
