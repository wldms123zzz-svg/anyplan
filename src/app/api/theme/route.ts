import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { profile, taste, condition } = await req.json();

  // 입력값 검증
  if (!condition?.myBody || !condition?.예산 || !condition?.mode) {
    return NextResponse.json({ error: "필수 값 누락" }, { status: 400 });
  }

  // 오늘 날짜 구하기 (YYYYMMDD 형식)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayStr = `${year}${month}${day}`;

  // 실시간 문화생활/축제 데이터 가져오기 (Tour API)
  let festivalContext = "";
  try {
    const tourKey = process.env.TOUR_API_KEY;
    if (tourKey) {
      // 지역 코드 매핑
      const AREA_CODES: Record<string, string> = {
        "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
        "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
      };
      
      const region = condition?.지역;
      const areaParam = (region && AREA_CODES[region]) ? `&areaCode=${AREA_CODES[region]}` : "";

      // 1.5초 타임아웃 설정 (공공데이터 API가 너무 느려서 전체가 지연되는 것 방지)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const tourUrl = `http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${todayStr}&numOfRows=5${areaParam}`;
      const tourRes = await fetch(tourUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const tourData = await tourRes.json();
      
      const items = tourData?.response?.body?.items?.item;
      if (items && items.length > 0) {
        const festivalList = items.map((f: any) => `- [${f.title}] (${f.addr1 || "위치 미상"})`).join("\n");
        festivalContext = `\n[참고 데이터: 현재 ${region || "전국"}에서 진행 중인 실제 축제/행사]\n${festivalList}\n(이 행사들 중 유저의 취향에 맞는 것이 있다면 적극적으로 활용해서 현실적인 데이트 코스를 짜줘. 특히 ${region && region !== '전국' ? region + ' 지역의 ' : ''}행사를 우선적으로 고려해줘.)\n`;
      } else {
        throw new Error("No items returned");
      }
    } else {
      throw new Error("No API key");
    }
  } catch (err) {
    console.log("Tour API Fetch failed, using fallback local knowledge.", err);
    const region = condition?.지역 || "전국";
    festivalContext = `\n(참고: 현재 외부 API를 통한 실시간 축제 정보 로드에 실패했습니다. 하지만 네가 알고 있는 **${region} 지역의 유명한 축제, 팝업스토어, 야시장, 특별 전시회** 등 실제 존재하는 로컬 핫플레이스 정보를 최대한 동원해서 아주 리얼하고 구체적인 데이트 코스를 짜줘. "카페 가기" 같은 뻔한 내용 대신, ${region}에 실제로 있는 장소 이름을 언급하면 더 좋아.)\n`;
  }

  // 관계 및 나이차 추론 로직
  const ageDiff = Math.abs((profile?.myAge || 20) - (profile?.partnerAge || 20));
  const isFamily = ageDiff >= 20;
  const relationshipType = isFamily ? "나이차가 많이 나는 가족(부모님 등)과의 소중한 외출" : "커플 데이트";
  const focusPoint = isFamily 
    ? "부모님이나 가족이 함께 무리 없이 즐길 수 있는 동선과 편안함을 최우선으로 고려해줘." 
    : "커플이 즐기기 좋은 로맨틱하거나 재밌는 코스로 짜줘.";

  const prompt = `너는 세상에서 가장 기발하고 트렌디한 데이트/외출 코스 기획자야. 아래 정보를 바탕으로 오늘 당장 실행할 수 있는 '미친 디테일의' 코스 하나를 뽑아줘.

[프로필 정보]
관계: ${relationshipType}
나: ${profile?.myAge || 20}세 ${profile?.myGender || "무관"}
동행인: ${profile?.partnerAge || 20}세 ${profile?.partnerGender || "무관"}

[취향 및 무드]
원하는 무드: ${taste?.무드?.join(", ") || "무관"}
활동: ${taste?.활동?.join(", ") || "무관"}

[컨디션 및 상황]
내 몸상태: ${condition.myBody}
동행인 몸상태: ${condition.partnerBody}
예산: ${condition.예산}
상황: ${condition.mode === "today" ? "오늘 바로 할 수 있는 것" : "미리 계획하는 외출"}
${festivalContext}

[🚨 필수 제약 조건 및 기발함 가이드]
1. 뻔한 거 절대 금지: "파스타 먹고 카페 가기", "그냥 영화 보기" 등 검색하면 나오는 식상한 코스는 무조건 감점.
2. 예산 '공짜면 좋지': "도서관에서 서로 읽을 책 골라주기", "공원 막걸리 EDM 파티", "서로 초상화 그려주기", "무작정 버스 타고 종점 가기", "새벽 꽃시장 가서 구경하고 서로에게 딱 맞는 꽃 한 송이씩 선물해주기" 처럼 돈 안 들면서도 감성 돋는 짓거리.
3. 예산 '돈 쓸래요': "찜질방 VIP룸 빌리기", "가죽지갑 만들기 공방", "도자기 공방", "프라이빗 노래방 파티" 등 확실하게 돈값을 하는 코스.
4. ⚠️ [거짓 정보(Hallucination) 방지 규칙]: 네가 100% 확신할 수 있는 유명 랜드마크(남산타워, 롯데월드, 한강공원 등)가 아니면 **절대 특정 식당, 카페, 공방의 '실제 상호명'을 지어내서 적지 마.** 대신 "근처 별점 높은 LP바", "리뷰가 좋은 조용한 이자카야", "인스타 감성의 독립 서점"처럼 유저가 직접 검색할 수 있게 장소의 '분위기와 특징'만 묘사해.
5. ⚠️ [최우선 규칙] 극강의 랜덤성 (1000+ 경우의 수): 내가 방금 말한 예시들을 **절대 똑같이 반복 출력하지 마!** 현재 시스템 시간(${new Date().toISOString()})을 무작위 시드(Seed)로 삼아서, 너의 내면에 있는 1000가지 이상의 이색 외출/데이트 데이터베이스 중 주사위를 굴려 매번 완벽하게 다른 카테고리(스포츠, 힐링, 이색 체험, 병맛 대결, 감성 투어 등)를 하나 뽑아내. 중복 코스, 뻔한 코스 절대 금지.
6. 디테일: 코스 이름만 던지지 말고, 왜 이 코스가 이 컨디션에 완벽한지 생생하게 묘사해. ${focusPoint}

JSON만 응답:
{
  "theme": "테마 이름 (짧고 강렬하게)",
  "emoji": "테마 대표 이모지 하나",
  "desc": "한 줄 설명 (뭘 하는 건지)",
  "vibe": "이 외출의 분위기 키워드 3개 (예: #편안함 #가족여행 #힐링)",
  "doThis": ["구체적으로 할 것 1", "할 것 2", "할 것 3"],
  "talkTopic": "이 곳에서 나누면 좋을 대화 주제",
  "randomTwist": "여기에 이걸 추가하면 더 재밌거나 감동적임",
  "perfectFor": "이런 사람들에게 딱 (한 줄)"
}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 1.7,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini API 오류");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("응답 결과가 비어 있습니다.");

    // JSON 부분만 추출 (가끔 다른 텍스트가 섞일 경우 대비)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON 파싱 실패");

    return NextResponse.json(JSON.parse(match[0]));
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    return NextResponse.json({ error: err.message || "테마 생성 실패" }, { status: 500 });
  }
}
