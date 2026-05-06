import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { profile, taste, condition } = await req.json();
    const tourKey = process.env.TOUR_API_KEY;
    let realData = "";
    
    if (tourKey && condition.지역 !== "전국") {
      const AREA_CODES: Record<string, string> = {
        "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
        "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
      };
      const areaCode = AREA_CODES[condition.지역] || "";
      
      // 개별 API 호출을 독립적으로 처리하여 하나가 실패해도 전체가 죽지 않게 함
      const fetchTourData = async (url: string) => {
        try {
          const res = await fetch(url, { next: { revalidate: 3600 } });
          if (!res.ok) return null;
          return await res.json();
        } catch (e) {
          console.error(`API Call Failed: ${url}`, e);
          return null;
        }
      };

      const [festData, histData] = await Promise.all([
        fetchTourData(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=20240101&numOfRows=10&areaCode=${areaCode}`),
        fetchTourData(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=12&numOfRows=10&areaCode=${areaCode}&cat1=A02&cat2=A0201`)
      ]);
      
      if (festData?.response?.body?.items?.item) {
        const items = festData.response.body.items.item;
        const festivalList = Array.isArray(items) ? items.map((f: any) => `- [${f.title}] (${f.addr1 || "위치 미상"})`).join("\n") : `- [${items.title}] (${items.addr1 || "위치 미상"})`;
        realData += `\n현재 ${condition.지역}에서 열리는 주요 행사/축제:\n${festivalList}`;
      }

      if (histData?.response?.body?.items?.item && taste.활동.includes("역사 탐방 🏛️")) {
        const items = histData.response.body.items.item;
        const histList = Array.isArray(items) ? items.map((h: any) => `- [${h.title}] (${h.addr1 || "위치 미상"})`).join("\n") : `- [${items.title}] (${items.addr1 || "위치 미상"})`;
        realData += `\n현재 ${condition.지역}의 주요 역사/문화 명소:\n${histList}`;
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
         - '뚜벅이 데이트'라면 추천 장소와 가장 가까운 **지하철역이나 버스 정류장** 명칭을 포함하세요.
         - '자차 데이트'라면 해당 장소의 **주차 팁**을 포함하세요.
      2. 컨디션 맞춤형 로직:
         - 만약 '녹초 상태 🫠'가 선택되었다면 야외보다는 실내 휴식 위주로 구성하세요.
      3. 테마: '역사 탐방'이나 '음악/공연' 등이 선택되었다면 관련 명소를 적극 활용하세요.

      [응답 형식 (JSON만 출력, 마크다운 기호 없이)]
      {
        "theme": "제목",
        "emoji": "이모지",
        "desc": "설명",
        "vibe": "분위기",
        "doThis": ["할일1", "할일2", "할일3"],
        "transportInfo": "교통/주차 정보",
        "talkTopic": "대화주제",
        "randomTwist": "팁/미션",
        "perfectFor": "추천대상"
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // JSON 추출 및 파싱 안정화
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 응답 형식 오류");
    const jsonResponse = JSON.parse(jsonMatch[0]);

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("AI API Error:", error);
    return NextResponse.json({ error: "테마를 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
