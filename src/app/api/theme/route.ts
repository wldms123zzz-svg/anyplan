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

    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    let realData = "";
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
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            const items = data?.response?.body?.items?.item;
            return items ? (Array.isArray(items) ? items : [items]) : [];
          } catch (e) { return []; }
        };

        const targetYear = "2026";
        const targetMonth = String(new Date().getMonth() + 1).padStart(2, "0");
        
        const [festItems, areaItems, craftItems] = await Promise.all([
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonth}01&lDongRegnCd=${regnCd}&numOfRows=10`),
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&lDongRegnCd=${regnCd}&numOfRows=10&arrange=Q`),
          taste.활동.includes("만들기") 
            ? fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(currentRegion + " 공방 원데이클래스")}&numOfRows=10`)
            : Promise.resolve([])
        ]);

        const combined = [...festItems, ...areaItems].filter(i => i && i.title);
        if (combined.length > 0) {
          realData = combined.sort(() => 0.5 - Math.random()).slice(0, 10).map((i: any) => `${i.title}(${i.addr1 || ""})`).join(", ");
        }
        if (craftItems?.length > 0) {
          workshopData = craftItems.map((i: any) => `${i.title}(공방: ${i.addr1 || ""})`).join(", ");
        }
      } catch (e) {}
    }

    const prompt = `
      당신은 대한민국 최고의 '로컬 힙스터 데이트 플래너'입니다. 지루하고 중복되는 추천은 금물입니다.
      
      [미션: 3단계 시네마틱 저니]
      각 단계는 서로 다른 성격의 활동으로 구성되어야 하며, 장소와 행동이 유기적으로 연결되어야 합니다.

      1. **Step 01 (Experience)**: 해당 지역의 힙한 명소(제공된 데이터 활용)에서 즐기는 이색적인 활동. (예: DDP 푸드트럭에서 각자 취향의 길거리 음식 맛보기)
      2. **Step 02 (Atmosphere)**: 그 장소의 시각적/감성적 포인트를 활용한 '인생샷' 또는 '몰입형' 순간. (예: LED 장미 정원의 야경을 배경으로 서로의 사진 찍어주기)
      3. **Step 03 (Connection)**: 장소를 옮기거나 근처 고요한 곳(청계천, 수성못 등)으로 이동해 나누는 로맨틱한 산책과 깊은 대화.

      [스타일 가이드]
      - 문장은 아주 **간결하고 가독성 좋게** 작성하세요 (활동당 최대 2문장).
      - '커플', '연인', '데이트' 단어 절대 사용 금지. '우리', '함께' 등으로 표현.
      - **Random Twist**: 가위바위보 게임, 편지 쓰기, 사진 스크랩, 서로의 첫인상 묘사하기 등 아주 **센스 있고 창의적인** 미션을 제안하세요.

      [입력 데이터]
      지역: ${currentRegion}
      취향: ${taste.무드.join(", ")}, ${taste.활동.join(", ")}
      이동수단: ${condition.이동수단}
      실시간 장소: ${realData || "해당 지역 랜드마크"}
      공방: ${workshopData || "없음"}

      반드시 아래 JSON 형식으로 응답하세요:
      {
        "theme": "테마 제목",
        "emoji": "이모지",
        "vibe": ["#태그1", "#태그2"],
        "desc": "이 코스의 핵심 감성 (한 줄)",
        "doThis": [
          "활동내용1 (장소 + 구체적 행동, 번호 없이)",
          "활동내용2 (감성 + 상호작용, 번호 없이)",
          "활동내용3 (마무리 + 대화, 번호 없이)"
        ],
        "transportInfo": "이동수단 맞춤 팁",
        "talkTopic": "오늘 나누면 좋을 깊은 대화 주제",
        "randomTwist": "더 재미있게 즐길 센스 있는 미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음 추천", "reason": "이유", "emoji": "이모지" }
      }
    `;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: 'no-store',
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          response_mime_type: "application/json"
        }
      })
    });

    const data = await geminiRes.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    return NextResponse.json(JSON.parse(resultText.trim()));

  } catch (error: any) {
    return NextResponse.json({ 
      theme: `${currentRegion}의 영화 같은 하루`,
      emoji: "🎬",
      vibe: ["#로맨틱성공적", "#우리만의서사"],
      desc: "함께 걷는 모든 길이 하나의 이야기가 되는 코스입니다.",
      doThis: [
        "01 근처 가장 힙한 푸드 마켓을 찾아 서로의 취향이 담긴 음식을 골라 가볍게 맛보기",
        "02 장소의 독특한 야경이나 오브제를 배경으로 오늘 이 순간의 우리를 기록하는 사진 남기기",
        "03 물소리가 들리는 근처 산책로를 따라 손을 잡고 걷으며 오늘 가장 행복했던 1분을 공유하기"
      ],
      transportInfo: condition.이동수단?.includes("뚜벅이") ? "가까운 역에서 내려 가벼운 발걸음으로 시작하세요." : "인근 주차장을 활용해 여유롭게 이동하세요.",
      talkTopic: "오늘 우리가 마주친 풍경 중 가장 닮고 싶은 것은 뭐야?",
      randomTwist: "가위바위보를 해서 지는 사람이 오늘 가장 마음에 드는 사진 하나 골라주기",
      perfectFor: "평범한 하루를 특별하게 기록하고 싶은 우리",
      nextDate: { place: "동네 작은 독립서점", reason: "이후의 여운", emoji: "📚" }
    });
  }
}
