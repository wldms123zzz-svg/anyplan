import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let currentRegion = "전국";
  
  try {
    const body = await req.json();
    const { profile, taste, condition } = body;
    currentRegion = condition.지역 || "전국";
    
    const apiKey = process.env.GEMINI_API_KEY;
    const tourKey = process.env.TOUR_API_KEY;
    const cultureKey = process.env.CULTURE_API_KEY || tourKey;
    const durunubiKey = process.env.DURUNUBI_API_KEY || tourKey;

    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    let realData = "";
    let cultureData = "";
    let durunubiData = "";
    let workshopData = "";

    const AREA_CODES: Record<string, string> = {
      "서울": "11", "인천": "28", "대전": "30", "대구": "27", "광주": "29", "부산": "26", "울산": "31", "세종": "36",
      "경기": "41", "강원": "42", "충북": "43", "충남": "44", "전북": "45", "전남": "46", "경북": "47", "경남": "48", "제주": "50"
    };
    const regnCd = AREA_CODES[currentRegion] || "";

    if (tourKey && regnCd) {
      try {
        const fetchItems = async (url: string) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8초로 소폭 상향
            const res = await fetch(url, { 
              signal: controller.signal,
              cache: 'no-store'
            });
            clearTimeout(timeoutId);
            const data = await res.json();
            const items = data?.response?.body?.items?.item;
            return items ? (Array.isArray(items) ? items : [items]) : [];
          } catch (e) { return []; }
        };

        const targetYear = "2026";
        const targetMonth = String(new Date().getMonth() + 1).padStart(2, "0");
        
        // 병렬 호출 (최대 5개)
        const [festItems, areaItems, cultItems, pathItems, craftItems] = await Promise.all([
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonth}01&lDongRegnCd=${regnCd}&numOfRows=15`),
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&lDongRegnCd=${regnCd}&numOfRows=15&arrange=Q`),
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${cultureKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(currentRegion + " 전시")}&contentTypeId=14&numOfRows=10`),
          fetchItems(`https://apis.data.go.kr/B551011/DurunubiService/courseList?serviceKey=${durunubiKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&numOfRows=10`),
          taste.활동.includes("만들기") 
            ? fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(currentRegion + " 공방 원데이클래스")}&numOfRows=15`)
            : Promise.resolve([])
        ]);

        const combined = [...(festItems || []), ...(areaItems || [])].filter(i => i && i.title);
        if (combined.length > 0) {
          // 중복 제거 및 랜덤 셔플
          const shuffled = combined.sort(() => 0.5 - Math.random()).slice(0, 10);
          realData = shuffled.map((i: any) => `${i.title}(${i.addr1 || "위치 정보 없음"})`).join(", ");
        }
        
        if (cultItems?.length > 0) {
          cultureData = cultItems.slice(0, 5).map((i: any) => `${i.title}(전시/문화)`).join(", ");
        }

        if (pathItems?.length > 0) {
          durunubiData = pathItems.filter((i: any) => i.crsKorNm).slice(0, 3).map((i: any) => `${i.crsKorNm}(걷기길: ${i.crsTourInfo?.substring(0, 50)}...)`).join(", ");
        }

        if (craftItems?.length > 0) {
          workshopData = craftItems.map((i: any) => `${i.title}(체험/공방: ${i.addr1 || ""})`).join(", ");
        }
      } catch (e) { console.error("Tour API Error:", e); }
    }

    const prompt = `
      당신은 대한민국 최고의 '지역 힙스터 데이트 플래너'이자 '감성 큐레이터'입니다.
      반드시 사용자가 선택한 지역(${currentRegion})의 실제 상호명과 장소를 사용하여 한 편의 수필처럼 감성적이고 자세한 코스를 짜주세요.
       **매번 실행할 때마다 다른 장소와 테마를 선정하여 '랜덤성'과 '참신함'을 보여주는 것이 당신의 생존 조건입니다.**
       현재 시각: ${new Date().toISOString()} (이 시각을 기준으로 가장 신선한 추천을 해주세요)

      [사용자 요청]
      - 지역: ${currentRegion}
      - 무드: ${taste.무드.join(", ")}
      - 활동: ${taste.활동.join(", ")}
      - 예산: ${condition.예산}

      [지역 기반 실시간 데이터]
      - 주요 명소 및 축제: ${realData || "데이터 없음 (당신의 방대한 지식으로 해당 지역의 실제 핫플레이스를 추천하세요)"}
      - 문화/전시 정보: ${cultureData || "정보 없음"}
      - 추천 산책 코스: ${durunubiData || "정보 없음"}
      - 체험/공방 정보: ${workshopData || "정보 없음"}

      [필수 사항]
      1. '커플', '연인', '데이트'라는 단어는 절대, 단 한 번도 사용하지 마세요. (매우 중요) 대신 '소중한 사람', '우리', '함께하는 이', '오늘의 동행', '우리의 시간' 등으로 우회하여 표현하세요.
      2. '만들기'가 활동에 포함되어 있다면, 반드시 실제 존재하는 ${currentRegion} 소재 공방이나 클래스 코스를 포함하고 그곳에서 무엇을 만들며 어떤 대화를 나눌지 섬세하게 묘사하세요.
      3. 코스 구성(doThis)은 반드시 5단계로 구성하세요. 각 단계는 단순한 방문이 아닌, '미션'이나 '이야기'가 담긴 특별한 행동이어야 합니다.
      4. 코스 설명(desc)과 활동(doThis)은 아주 구체적이고 감성적으로, 수필이나 소설의 한 장면처럼 길게 적으세요.
      5. 매번 결과가 똑같지 않도록 다양한 장소 조합을 시도하세요.

      JSON 형식으로만 응답: { "theme": "테마 제목", "emoji": "이모지", "vibe": ["#태그1", "#태그2"], "desc": "상세 설명", "doThis": ["활동1", "활동2", "활동3", "활동4", "활동5"], "transportInfo": "이동 정보", "talkTopic": "대화 주제", "randomTwist": "돌발 미션", "perfectFor": "추천 대상", "nextDate": { "place": "장소명", "reason": "이유", "emoji": "이모지" } }
    `;

    // 2026년 기준 최신 모델인 gemini-3-flash-preview로 업데이트
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: 'no-store',
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 1.0, // 랜덤성 극대화
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiRes.ok) {
      const errorData = await geminiRes.json();
      throw new Error(`Gemini API Error: ${geminiRes.status} ${JSON.stringify(errorData)}`);
    }

    const data = await geminiRes.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // JSON 문자열 정제 (백틱 제거 등)
    const cleanedJson = resultText.replace(/```json|```/g, "").trim();
    return NextResponse.json(JSON.parse(cleanedJson));

  } catch (error: any) {
    console.error("Critical API Error:", error.message);
    // 네트워크 오류 시 사용자에게 보여줄 메시지 (현장감을 살린 폴백)
    return NextResponse.json({ 
      theme: `${currentRegion}에서 마주한 뜻밖의 순간`,
      emoji: "🍃",
      vibe: ["#우연한기록", "#무작정걷기", "#우리만의대화"],
      desc: "잠시 데이터 연결이 원활하지 않아 AI가 완벽한 코스를 짜지 못했지만, 오히려 계획 없는 발걸음이 더 아름다운 조각을 만들어낼지도 모릅니다. 지금 눈앞에 보이는 가장 예쁜 길을 따라 걸어보는 건 어떨까요?",
      doThis: [
        `${currentRegion}의 이름 모를 작은 골목길 끝까지 걸어가 보기`,
        "가장 오래된 나무 아래서 잠시 눈을 감고 바람 소리 듣기",
        "우연히 발견한 카페의 시그니처 메뉴 같이 나눠 마시기",
        "오늘 하루 중 서로에게 가장 해주고 싶은 말 한마디 기록하기",
        "지나가는 풍경 속에서 우리를 닮은 색깔 하나 찾아보기"
      ],
      transportInfo: "가까운 역에서 내려 정처 없이 걷기",
      talkTopic: "만약 오늘이 우리에게 주어진 마지막 휴가라면, 넌 지금 무엇을 하고 싶어?",
      randomTwist: "길을 걷다 마음에 드는 풍경이 보이면 멈춰서 서로의 뒷모습 찍어주기",
      perfectFor: "정해진 틀에서 벗어나고 싶은 오늘",
      nextDate: { place: "동네 작은 독립서점", reason: "조용한 대화를 위해", emoji: "📚" }
    });
  }
}
