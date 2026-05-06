import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { profile, taste, condition } = await req.json();
    const tourKey = process.env.TOUR_API_KEY;
    let realData = "";
    
    // 안전 필터 설정 (검열 완화)
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    if (tourKey && condition.지역 !== "전국") {
      const AREA_CODES: Record<string, string> = {
        "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
        "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
      };
      const areaCode = AREA_CODES[condition.지역] || "";
      
      const fetchTourData = async (url: string) => {
        try {
          const res = await fetch(url, { next: { revalidate: 3600 } });
          if (!res.ok) return null;
          return await res.json();
        } catch (e) { return null; }
      };

      const [festData, histData] = await Promise.all([
        fetchTourData(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=20240101&numOfRows=5&areaCode=${areaCode}`),
        fetchTourData(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=12&numOfRows=5&areaCode=${areaCode}`)
      ]);
      
      if (festData?.response?.body?.items?.item) {
        const items = festData.response.body.items.item;
        realData += `\n추천 장소/행사: ${Array.isArray(items) ? items.map((f:any)=>f.title).join(", ") : items.title}`;
      }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

    const prompt = `
      당신은 데이트 플래너입니다. 아래 정보를 바탕으로 데이트 테마를 추천하고 JSON으로만 답변하세요.
      [정보] 지역:${condition.지역}, 이동:${condition.이동수단}, 무드:${taste.무드}, 활동:${taste.활동}, 예산:${condition.예산}
      [데이터] ${realData}
      [형식] {"theme":"제목","emoji":"✨","desc":"설명","vibe":"분위기","doThis":["1","2","3"],"transportInfo":"팁","talkTopic":"주제","randomTwist":"미션","perfectFor":"대상"}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    // 후보가 아예 없는 경우 (안전 필터 등에 의해 차단됨)
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("AI가 답변을 생성할 수 없는 상태입니다 (Safety Block).");
    }

    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");
    
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    console.error("AI Error:", error);
    // 폴백 응답 (에러 시에도 화면이 깨지지 않게 함)
    return NextResponse.json({
      theme: "낭만 가득 데이트",
      emoji: "💕",
      desc: "잠시 서버 연결이 원활하지 않아 준비한 추천 코스입니다.",
      vibe: "언제나 즐거운 우리만의 시간",
      doThis: ["근처 맛집 탐방하기", "조용한 카페에서 대화 나누기", "함께 산책하며 사진 찍기"],
      transportInfo: "가까운 공영 주차장을 이용하시거나 대중교통을 권장합니다.",
      talkTopic: "우리 처음 만났을 때의 기억",
      randomTwist: "가위바위보로 진 사람이 커피 사기!",
      perfectFor: "모든 커플"
    });
  }
}
