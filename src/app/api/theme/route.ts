import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { taste, condition } = await req.json();

  // 입력값 검증
  if (!condition?.에너지 || !condition?.예산 || !condition?.mode) {
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

      // url 인코딩된 키가 아니면 오류가 날 수 있으므로 그대로 씁니다 (공공데이터포털 특성)
      const tourUrl = `http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${todayStr}&numOfRows=5${areaParam}`;
      const tourRes = await fetch(tourUrl);
      const tourData = await tourRes.json();
      
      const items = tourData?.response?.body?.items?.item;
      if (items && items.length > 0) {
        const festivalList = items.map((f: any) => `- [${f.title}] (${f.addr1 || "위치 미상"})`).join("\n");
        festivalContext = `\n[참고 데이터: 현재 ${region || "전국"}에서 진행 중인 실제 축제/행사]\n${festivalList}\n(이 행사들 중 유저의 취향에 맞는 것이 있다면 적극적으로 활용해서 현실적인 데이트 코스를 짜줘. 특히 ${region && region !== '전국' ? region + ' 지역의 ' : ''}행사를 우선적으로 고려해줘.)\n`;
      }
    }
  } catch (err) {
    console.log("Tour API Fetch failed, skipping real-time data.", err);
  }

  const prompt = `너는 커플 데이트 테마 제안봇이야. 아래 취향을 보고 오늘의 데이트 테마 하나를 뽑아줘.

취향: ${taste?.분위기?.join(", ") || "무관"} / ${taste?.활동?.join(", ") || "무관"}
에너지: ${condition.에너지}
예산: ${condition.예산}
모드: ${condition.mode === "today" ? "오늘 바로 할 수 있는 것" : "미리 계획하는 데이트"}
${festivalContext}
테마는 구체적이고 참신하게. "카페 가기" 같은 뻔한 건 금지.
예시: "새벽 편의점 투어 + 공원 돗자리 브이로그 찍기", "집에서 나라별 야식 배달 시켜먹으며 여행 계획 짜기", "볼링 내기 후 진 사람이 쏘는 마라탕"

JSON만 응답:
{
  "theme": "테마 이름 (짧고 강렬하게)",
  "emoji": "테마 대표 이모지 하나",
  "desc": "한 줄 설명 (뭘 하는 건지)",
  "vibe": "이 데이트의 분위기 키워드 3개 (예: #즉흥적 #웃김 #배부름)",
  "doThis": ["구체적으로 할 것 1", "할 것 2", "할 것 3"],
  "talkTopic": "이 데이트에서 나누면 좋을 대화 주제",
  "randomTwist": "여기에 이걸 추가하면 더 재밌어짐 (엉뚱한 아이디어 하나)",
  "perfectFor": "이런 커플에게 딱 (한 줄)"
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
