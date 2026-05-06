import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { profile, taste, condition } = await req.json();
    
    // 한국관광공사 API 데이터 가져오기 (실시간성 확보)
    const tourKey = process.env.TOUR_API_KEY;
    let realData = "";
    
    if (tourKey && condition.지역 !== "전국") {
      const AREA_CODES: Record<string, string> = {
        "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
        "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
      };
      const areaCode = AREA_CODES[condition.지역] || "";
      
      // 1. 축제 정보 가져오기
      const festivalUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=20240101&numOfRows=10&areaCode=${areaCode}`;
      
      // 2. 걷기 코스 (두루누비) 가져오기 (활동이 '걷기'인 경우 또는 뚜벅이인 경우)
      const durunubiUrl = `https://apis.data.go.kr/B551011/Durunubi/courseList?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&numOfRows=5`;

      // 3. 역사/문화지 정보 가져오기 (활동이 '역사 탐방'인 경우)
      const historyUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=12&numOfRows=10&areaCode=${areaCode}&cat1=A02&cat2=A0201`;

      try {
        const [festRes, historyRes] = await Promise.all([
          fetch(festivalUrl),
          fetch(historyUrl)
        ]);
        
        const festData = await festRes.json();
        const histData = await historyRes.json();
        
        const items = festData?.response?.body?.items?.item || [];
        const histItems = histData?.response?.body?.items?.item || [];
        
        if (items && items.length > 0) {
          const festivalList = Array.isArray(items) ? items.map((f: any) => `- [${f.title}] (${f.addr1 || "위치 미상"})`).join("\n") : `- [${items.title}] (${items.addr1 || "위치 미상"})`;
          realData += `\n현재 ${condition.지역}에서 열리는 주요 행사/축제:\n${festivalList}`;
        }

        if (histItems && histItems.length > 0 && taste.활동.includes("역사 탐방 🏛️")) {
          const histList = Array.isArray(histItems) ? histItems.map((h: any) => `- [${h.title}] (${h.addr1 || "위치 미상"})`).join("\n") : `- [${histItems.title}] (${histItems.addr1 || "위치 미상"})`;
          realData += `\n현재 ${condition.지역}의 주요 역사/문화 명소:\n${histList}`;
        }
      } catch (e) {
        console.error("실시간 데이터 호출 실패:", e);
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      당신은 세상에서 가장 센스 있는 데이트 플래너입니다. 
      아래의 사용자 정보를 바탕으로 아주 구체적이고 매력적인 데이트 테마 1개를 추천해주세요.

      [사용자 정보]
      - 우리: ${profile.myAge}세 ${profile.myGender}, 상대방 ${profile.partnerAge}세 ${profile.partnerGender}
      - 무드: ${taste.무드.join(", ")}
      - 활동: ${taste.활동.join(", ")}
      - 우리의 현재 컨디션: 나(${condition.myBody}), 상대방(${condition.partnerBody})
      - 예산: ${condition.예산}
      - 지역: ${condition.지역}
      - 이동수단: ${condition.이동수단}

      [참고할 실시간 데이터]
      ${realData}

      [필수 포함 내용]
      1. 이동수단 맞춤형 정보:
         - '뚜벅이 데이트'라면 추천 장소와 가장 가까운 **지하철역이나 버스 정류장** 명칭을 반드시 포함하세요.
         - '자차 데이트'라면 해당 장소의 **주차 팁(주차장 여부, 근처 공영주차장 등)**을 반드시 포함하세요.
      2. 컨디션 맞춤형 로직:
         - 만약 어느 한 명이라도 '녹초 상태 🫠'를 선택했다면, 활동적인 야외 활동은 배제하고 실내 휴식, 프라이빗 룸, 홈데이트, 조용한 카페 위주로 구성하세요.
      3. 역사 탐방/음악 테마:
         - '역사 탐방'이 선택되었다면 위 실시간 데이터의 명소를 우선적으로 고려하여 교양 있고 흥미로운 코스를 짜주세요.
         - '음악/공연'이 선택되었다면 라이브 카페, 재즈 바, 또는 LP바 등 음악 중심의 분위기 있는 장소를 제안하세요.

      [응답 형식 (JSON만 출력)]
      {
        "theme": "데이트 테마 제목 (예: '시간 여행자의 산책')",
        "emoji": "테마와 어울리는 이모지 하나",
        "desc": "테마에 대한 짧고 매혹적인 설명",
        "vibe": "이 데이트의 분위기 한 줄 요약",
        "doThis": ["첫 번째 할 일 (상세하게)", "두 번째 할 일", "세 번째 할 일"],
        "transportInfo": "교통편/주차 상세 정보 (뚜벅이: 가까운 역/정류장, 자차: 주차 정보)",
        "talkTopic": "그날 나누면 좋을 이색 대화 주제",
        "randomTwist": "데이트의 재미를 더할 돌발 미션/팁",
        "perfectFor": "이 테마가 누구에게 최고의 선택인지"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 추출 (Gemini가 마크다운으로 감쌀 경우 대비)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "결과 생성 실패" };

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: "테마를 생성하는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
