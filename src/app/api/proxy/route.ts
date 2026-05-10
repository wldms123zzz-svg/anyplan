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
뻔한 관광이 아닌, 커플이 열광할 '구체적이고 참신한 놀이 테마'를 설계하세요.

[골든 스탠다드 - 테마 및 활동 예시]
- "새벽 편의점 투어 + 공원 돗자리 브이로그 찍기"
- "집에서 나라별 야식 배달 시켜먹으며 다음 여행 계획 짜기" (실내 데이트)
- "볼링 내기 후 진 사람이 쏘는 마라탕 투어"
- "01 고분 능선을 배경으로 서로의 '숨바꼭질' 숏폼 찍어주기"

[코스 구성 규칙]
- 테마 이름: '카페 가기' 같은 뻔한 명사형 금지. [활동+활동+장소]가 결합된 참신한 문장으로 지으세요.
- 활동 01, 02: 메인 스팟에서의 구체적이고 능동적인 행동(내기, 놀이, 촬영, 쓰기 등).
- 활동 03: 자리를 옮겨 구체적 [장소명]에서 하루를 완성하는 마무리 활동.
- randomTwist (필수): "여기에 이걸 추가하면 더 재밌어짐! (엉뚱한 아이디어 하나)"

[핵심 설계 원칙]
1. 능동적 동사 사용: '보기/걷기' 대신 '내기하기', '찍어주기', '만들기', '찾기' 등 상호작용이 일어나는 동사를 사용하세요.
2. 장소 밀착형 미션: 그 장소에서만 할 수 있는 엉뚱하고 재미있는 행동을 설계하세요.
3. 담백한 디테일: 미사여구 없이 "무엇을 어떻게 할지"만 세밀하게 기술하세요.

[입력 정보]
- 지역: ${condition.지역}, 체력: ${condition.체력}
- 동행: ${profile.myAge}대와 ${profile.partnerAge}대, 취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}

[출력 형식 (JSON)]
{
  "theme": "구체적이고 참신한 활동형 테마 이름",
  "desc": "그날의 분위기와 즐거움을 설명하는 한 줄",
  "emoji": "아이콘",
  "vibe": ["#내기", "#놀이", "#키워드"],
  "doThis": [
    { "title": "첫 번째 장면", "desc": "01 [구체적이고 능동적인 행동]" },
    { "title": "두 번째 장면", "desc": "02 [커플 상호작용/내기/놀이]" },
    { "title": "자리를 옮겨서", "desc": "03 인근의 '[구체적 장소명]'으로 이동하여, [마무리 활동]" }
  ],
  "funTip": "더 재밌게 즐기는 법 (플레이리스트 등)",
  "randomTwist": "여기에 이걸 추가하면 더 재밌어짐! (엉뚱한 아이디어)",
  "talkTopic": "그 장소에서 나누기 좋은 랜덤한 질문",
  "nearby": [{ "name": "명소", "type": "카페/식당", "reason": "이유", "emoji": "아이콘" }]
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
