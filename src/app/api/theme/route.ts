import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { profile, taste, condition } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    const tourKey = process.env.TOUR_API_KEY;

    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    let realData = "";
    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    const areaCode = AREA_CODES[condition.지역] || "";

    // 실시간 지역 데이터 페칭 (안정성 및 타임아웃 강화)
    if (tourKey && areaCode) {
      try {
        const encodedKey = tourKey.includes('%') ? tourKey : encodeURIComponent(tourKey);
        const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${encodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&areaCode=${areaCode}&numOfRows=20&arrange=Q`;
        
        // 타임아웃 5초로 연장
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(url, { 
          next: { revalidate: 3600 },
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        const items = data?.response?.body?.items?.item;
        if (items) {
          const itemList = Array.isArray(items) ? items : [items];
          realData = itemList
            .filter((i: any) => i.title && i.addr1)
            .map((i: any) => `${i.title}(${i.addr1})`)
            .join(", ");
          console.log(`Successfully fetched ${itemList.length} items for ${condition.지역}`);
        }
      } catch (e) {
        console.error("Tour API Fetching Failed:", e);
      }
    }

    const prompt = `
      당신은 대한민국 최고의 '지역 전문 데이트 플래너'입니다.

      [핵심 미션]
      사용자가 선택한 지역(${condition.지역})의 실제 명소를 사용하여 3단계 코스를 제안하세요. 
      만약 아래 '실시간 데이터'가 비어있더라도, 당신의 지식을 총동원하여 ${condition.지역}에 실존하는 구체적인 힙플레이스, 맛집, 산책로 이름을 반드시 사용해야 합니다. 
      '근처 공원', '유명한 맛집' 같은 추상적인 단어는 금지입니다.

      [사용자 정보]
      지역: ${condition.지역}, 무드: ${taste.무드}, 활동: ${taste.활동}, 예산: ${condition.예산}

      [현지 실시간 데이터]
      ${realData || "데이터 없음 (당신의 지식을 활용하여 구체적인 지명을 생성하세요)"}

      [응답 형식 (JSON 필수)]
      {
        "theme": "시적인 제목",
        "vibe": ["#태그1", "#태그2", "#태그3"],
        "desc": "3문장 이상의 풍부한 설명",
        "doThis": ["구체적인 장소명과 활동 1", "구체적인 장소명과 활동 2", "구체적인 장소명과 활동 3"],
        "transportInfo": "버스 번호, 지하철역, 주차장 정보 등 상세히",
        "talkTopic": "대화 주제",
        "randomTwist": "깜짝 미션",
        "perfectFor": "타겟 커플",
        "nextDate": { "place": "다음 데이트를 위해 예약할 힙플 상호명", "reason": "추천 이유와 예약 팁", "emoji": "📅" }
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const geminiData = await geminiRes.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error("AI 응답 없음");
    return NextResponse.json(JSON.parse(text));

  } catch (error: any) {
    console.error("Critical AI Route Error:", error);
    
    // 지역별 초정밀 백업 시스템 (AI 실패 시에도 실망시키지 않음)
    const REGION_FALLBACKS: Record<string, any> = {
      "서울": { theme: "성수동 빈티지 아지트 탐험", vibe: ["#성수핫플", "#빈티지감성", "#붉은벽돌"], doThis: ["디올 성수(서울 성동구 연무장5길 7) 앞에서 인증샷", "대림창고(서울 성동구 성수이로 78)에서 갤러리 감상", "서울숲 튤립 로드(서울 성동구 뚝섬로 273) 산책"], transportInfo: "2호선 성수역 4번 출구에서 연무장길 방향으로 도보 10분 거리입니다.", nextDate: { place: "성수 '모노하' 전시", reason: "예약 없이는 못 가는 감성 전시의 끝판왕!" } },
      "대구": { theme: "삼덕동 레트로 감성 투어", vibe: ["#삼덕동카페", "#김광석거리", "#레트로"], doThis: ["김광석 다시그리기 길(대구 중구 달구벌대로 2238) 버스킹 감상", "삼덕동 한옥 카페 '수페르가'(대구 중구 달구벌대로447길) 방문", "228기념중앙공원(대구 중구 동성로2길 80) 야경 산책"], transportInfo: "경대병원역 3번 출구에서 김광석거리 방향으로 도보 5분 거리입니다.", nextDate: { place: "동성로 '미라보양과자점'", reason: "예약 필수! 프리미엄 디저트 코스를 미리 준비하세요." } },
      "제주": { theme: "한림 해안선 낭만 드라이브", vibe: ["#협재바다", "#금능포구", "#오션뷰"], doThis: ["협재해수욕장(제주 제주시 한림읍 협재리 2497-1) 산책", "금능해수욕장 야자수 숲(제주 제주시 한림읍 금능리) 인증샷", "디저트 맛집 '우무'(제주 제주시 한림읍 한림로 542) 방문"], transportInfo: "제주 버스 202번 혹은 렌터카 이용 시 협재 공영주차장을 추천합니다.", nextDate: { place: "제주 '스누피 가든'", reason: "인기 폭발! 대기 없이 입장하려면 온라인 예매가 필수입니다." } },
      "부산": { theme: "해운대 달맞이길 로맨틱 코스", vibe: ["#해운대야경", "#달맞이길", "#오션뷰"], doThis: ["블루라인파크 해변열차(부산 해운대구 중동 1015-1) 탑승", "달맞이길 카페 '비비비당'(부산 해운대구 달맞이길 239) 방문", "더베이101(부산 해운대구 동백로 52) 야경 감상"], transportInfo: "중동역에서 7번 출구로 나와 달맞이길 방향으로 도보 혹은 택시 추천.", nextDate: { place: "광안리 '요트투어'", reason: "일몰 시간대는 황금 시간대! 일주일 전 예약하세요." } }
    };

    const chosen = REGION_FALLBACKS[condition.지역] || {
      theme: "우리 동네 숨은 힙플 탐방",
      vibe: ["#동네탐색", "#숨은명소", "#소소한행복"],
      doThis: ["지역에서 가장 오래된 서점 혹은 독립서점 방문", "평점이 가장 높은 로컬 카페에서 시그니처 메뉴 맛보기", "지자체에서 관리하는 야경 산책로 30분 걷기"],
      transportInfo: "대중교통을 이용해 익숙한 동네를 여행자의 시선으로 걸어보세요.",
      nextDate: { place: "프라이빗 원데이 클래스", reason: "우리만의 작품을 만드는 특별한 시간을 위해 미리 예약하세요!" }
    };

    return NextResponse.json({
      ...chosen,
      emoji: "✨",
      talkTopic: "오늘 간 곳 중에 사진이 가장 잘 나올 것 같은 곳은 어디야?",
      randomTwist: "가장 맘에 드는 배경에서 서로 10초 동안 모델처럼 포즈 잡고 사진 찍어주기!",
      perfectFor: "평범한 하루를 특별한 기억으로 바꾸고 싶은 커플"
    });
  }
}
