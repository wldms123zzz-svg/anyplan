import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
// Node.js 런타임 사용 (Gemini SDK 안정성 확보)

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
      
      const fetchTourData = async (contentType: string) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2초 타임아웃
          const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&areaCode=${areaCode}&contentTypeId=${contentType}&numOfRows=10&arrange=Q`;
          const res = await fetch(url, { next: { revalidate: 3600 }, signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) return null;
          return await res.json();
        } catch (e) { return null; }
      };

      const fetchFestivals = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const url = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&areaCode=${areaCode}&eventStartDate=20240101&numOfRows=5`;
          const res = await fetch(url, { next: { revalidate: 3600 }, signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) return null;
          return await res.json();
        } catch (e) { return null; }
      };

      const [attractions, restaurants, festivals] = await Promise.all([
        fetchTourData("12"), // 관광지
        fetchTourData("39"), // 음식점
        fetchFestivals()     // 축제
      ]);
      
      const extractItems = (data: any) => {
        const items = data?.response?.body?.items?.item;
        if (!items) return "";
        return (Array.isArray(items) ? items : [items]).map((i:any) => i.title).join(", ");
      };

      realData = `
        현지 인기 관광지: ${extractItems(attractions)}
        현지 추천 맛집: ${extractItems(restaurants)}
        현재 진행중인 축제: ${extractItems(festivals)}
      `;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

    const timestamp = new Date().toISOString();
    
    const prompt = `
      사용자 정보: ${JSON.stringify(profile)}
      취향: ${JSON.stringify(taste)}
      현재 상황: ${JSON.stringify(condition)}
      요청 시간: ${timestamp}
      현지 실시간 데이터: ${realData}

      위 정보를 바탕으로 아주 창의적이고, 시적이며, 풍부한 내용의 데이트 테마를 제안해주세요. 
      사용자의 설문 결과(무드: ${taste.무드}, 활동: ${taste.활동}, 예산: ${condition.예산})를 최우선으로 반영해야 합니다. 
      예를 들어 '공짜'면 무료 코스 위주로, '먹기'면 맛집 탐방 위주로 짜야 합니다.

      [응답 가이드라인]
      - theme: 스크린샷처럼 감성적이고 시적인 긴 제목 (예: "고분 언덕 위 시네마")
      - vibe: 3개 이상의 감각적인 해시태그 (예: "#초현실적 #비용0원 #사극분위기")
      - desc: 아주 감성적이고 시적인 긴 설명 (2~3문장)
      - doThis: 3가지의 아주 구체적이고 매력적인 활동 단계. 상호명이나 장소를 포함하여 자세히 설명하세요.
      - talkTopic: 두 사람의 관계를 깊게 만들어줄 구체적인 질문
      - randomTwist: "더 재밌게 하려면?" 섹션에 들어갈 깜짝 미션이나 팁
      - perfectFor: 이 코스가 어떤 커플(나이대, 상태)에게 딱인지 설명 (예: "체력 차이가 나지만 로맨틱한 사진을 건지고 싶은 20대 커플")

      (JSON 형식으로만 응답: { "theme": "...", "desc": "...", "vibe": "...", "emoji": "...", "doThis": ["...", "...", "..."], "transportInfo": "...", "talkTopic": "...", "randomTwist": "...", "perfectFor": "..." })
    `;

    // Gemini 호출에 7초 타임아웃 적용
    const geminiPromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Gemini Timeout")), 7000)
    );

    const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
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
    // 폴백 응답 (25가지 테마 중 랜덤 선택)
    const FALLBACKS = [
      { theme: "한강 피크닉 데이트", emoji: "🧺", desc: "탁 트인 한강 뷰를 보며 힐링하는 시간", vibe: "여유롭고 평화로운 분위기", doThis: ["돗자리 펴고 배달 음식 먹기", "라면 조리기에서 라면 끓여 먹기", "노을 보며 물멍하기"] },
      { theme: "레트로 오락실 데이트", emoji: "🕹️", desc: "추억의 게임으로 승부를 겨루는 재미", vibe: "왁자지껄 신나는 분위기", doThis: ["보글보글 끝판왕 도전", "철권으로 저녁 내기", "펌프로 체력 소모하기"] },
      { theme: "조용한 북카페 데이트", emoji: "📚", desc: "책 냄새 가득한 곳에서 나누는 정적인 시간", vibe: "지적이고 차분한 분위기", doThis: ["서로에게 어울리는 책 골라주기", "좋아하는 구절 공유하기", "따뜻한 차 마시기"] },
      { theme: "따릉이 시티 투어", emoji: "🚲", desc: "자전거를 타고 골목골목을 누비는 여행", vibe: "활동적이고 상쾌한 분위기", doThis: ["예쁜 카페 거리 자전거 타기", "숨겨진 공원 찾기", "편의점에서 시원한 음료수 마시기"] },
      { theme: "궁궐 달빛 산책", emoji: "🌙", desc: "고즈넉한 고궁에서 느끼는 밤의 정취", vibe: "우아하고 낭만적인 분위기", doThis: ["한복 대여해서 사진 찍기", "궁궐 야간 관람하기", "돌담길 걷기"] }
      // ... 실제로는 더 많은 테마가 들어갑니다
    ];
    const randomIdx = Math.floor(Math.random() * FALLBACKS.length);
    const chosen = FALLBACKS[randomIdx];

    return NextResponse.json({
      ...chosen,
      desc: `(AI 연결 지연으로 추천된 코스입니다) ${chosen.desc}`,
      transportInfo: "근처 대중교통 이용을 권장합니다.",
      talkTopic: "오늘 가장 즐거웠던 순간은?",
      randomTwist: "지나가는 강아지에게 인사하기!",
      perfectFor: "모든 커플"
    });
  }
}
