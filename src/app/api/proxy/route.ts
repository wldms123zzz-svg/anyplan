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
정보 나열이 아닌, 커플이 투닥거리며 즐길 수 있는 '진짜 놀거리'와 '감각적 장면'을 설계하세요.

[코스 구성 규칙]
- 활동 01, 02: 메인 스팟 안에서 벌어지는 구체적인 장면과 놀이/내기 설계.
- 활동 03 (필수): 인근으로 자리를 옮겨 하루를 마무리하는 단계. 반드시 구체적인 [장소명]을 포함하여 그곳에서 무엇을 할지 담백하게 설계하세요.
- randomTwist (필수): 장소와 상관없이 그날의 재미를 폭발시킬 엉뚱하고 기발한 미션이나 아이디어 하나를 제안하세요.

[핵심 설계 원칙]
1. 커플 상호작용 최우선: '보기/걷기' 대신 '누가 더 ~한지 내기하기', '서로에게 ~한 편지 써주기', '음식을 특정 방식으로 함께 즐기기' 등 두 사람이 함께 움직이는 활동을 넣으세요.
2. 내기와 놀이: 가위바위보로 소원 들어주기, 특정 사물 먼저 찾기 내기, MBTI 상황극 등 가벼운 게임과 미션을 적극 포함하세요.
3. 담백한 장면과 디테일: (예시) "01 서로의 폰을 클래식 필름 모드로 맞추고, 누가 더 '숨바꼭질' 느낌으로 찍는지 내기하며 사진 담아주기"
4. 공간 활용 먹기: 단순히 맛집 가기가 아니라, "편의점에서 산 음료를 고분 능선에 앉아 사극 OST와 함께 즐기기"처럼 장소의 매력을 더하는 식사/간식 장면을 넣으세요.

[필수 포함 요소]
- 커플 내기나 가벼운 게임
- 서로에게 남기는 짧은 메시지나 편지 활동
- 장소의 공기를 느끼며 즐기는 먹거리 장면

[문체 규칙]
- 관광앱/SNS 광고 문체 절대 금지. 조용하고 위트 있는 영화적 톤 유지.

[입력 정보]
- 지역: ${condition.지역}, 체력: ${condition.체력}
- 동행: ${profile.myAge}대와 ${profile.partnerAge}대, 취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}

[출력 형식 (JSON)]
{
  "theme": "스팟 이름과 놀이가 담긴 테마 이름",
  "desc": "그날의 분위기와 즐거움을 설명하는 한 줄",
  "emoji": "아이콘",
  "vibe": ["#내기", "#놀이", "#키워드"],
  "doThis": [
    { "title": "첫 번째 장면", "desc": "01 [메인 스팟에서의 구체적 행동]" },
    { "title": "두 번째 장면", "desc": "02 [메인 스팟에서의 내기/놀이/미션]" },
    { "title": "자리를 옮겨서", "desc": "03 인근의 '[구체적 장소명]'으로 자리를 옮겨, [그곳에서 할 담백하고 구체적인 활동]" }
  ],
  "funTip": "더 재밌게 즐기는 법 (예: 플레이리스트 등)",
  "randomTwist": "여기에 이걸 추가하면 더 재밌어짐! (엉뚱한 아이디어 하나)",
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
