import { NextResponse } from "next/server";

const AREA_CODES: Record<string, string> = {
  "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
  "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
};

// culture.go.kr 지역코드
const CULTURE_AREA: Record<string, string> = {
  "서울": "11", "인천": "28", "대전": "30", "대구": "27", "광주": "29", "부산": "26", "울산": "31", "세종": "36",
  "경기": "41", "강원": "42", "충북": "43", "충남": "44", "경북": "47", "경남": "48", "전북": "45", "전남": "46", "제주": "50"
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const IMG = {
  popup: "https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=200",
  exhibit: "https://images.unsplash.com/photo-1518998053574-53f026348984?w=200",
  event: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=200",
  perf: "https://images.unsplash.com/photo-1514525253361-bee243870eb2?w=200",
  fest: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=200",
  flower: "https://images.unsplash.com/photo-1496062031456-07b8f162a322?w=200",
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200",
  coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200",
  bamboo: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=200",
  light: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "";
  const month = searchParams.get("month") || String(new Date().getMonth() + 1);
  const areaCode = AREA_CODES[region] || "";

  const tourKey = (process.env.TOUR_API_KEY || "").trim();
  const cleanKey = tourKey.includes('%') ? tourKey : encodeURIComponent(tourKey);

  // 1차: 공공데이터 TourAPI 시도
  try {
    const baseUrl = "http://apis.data.go.kr/B551011/KorService1/areaBasedList1";
    const query = `?serviceKey=${cleanKey}&numOfRows=30&pageNo=1&MobileOS=ETC&MobileApp=anyplan&_type=json&contentTypeId=15&areaCode=${areaCode}&arrange=A`;
    const res = await fetch(baseUrl + query, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const text = await res.text();

    if (!text.includes("Unexpected") && text.trim().startsWith("{")) {
      const data = JSON.parse(text);
      const raw = data?.response?.body?.items?.item || [];
      const items = (Array.isArray(raw) ? raw : [raw]).filter((f: any) => f.title);
      if (items.length > 0) {
        return NextResponse.json({ festivals: items, trails: [], debug: { source: "tourapi", region, month } }, { headers: corsHeaders });
      }
    }
  } catch (_) { /* TourAPI 실패 - 다음 시도 */ }

  // 2차: 문화포털 API (culture.go.kr) 시도
  try {
    const cultureKey = (process.env.culture || "").trim();
    if (cultureKey) {
      const cultureArea = CULTURE_AREA[region] || "";
      const y = "2026";
      const mm = String(month).padStart(2, "0");
      const from = `${y}${mm}01`;
      const to = `${y}${mm}30`;
      const cultureUrl = `http://www.culture.go.kr/openapi/rest/publicperformancedisplays/area?from=${from}&to=${to}&sido=${cultureArea}&cPage=1&rows=30&sortStdr=1&serviceKey=${cultureKey}`;
      const res = await fetch(cultureUrl, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      const text = await res.text();

      // XML 응답에서 공연/전시 정보 파싱
      if (text.includes("<db>") && !text.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR") && !text.includes("LIMITED_NUMBER_OF_SERVICE")) {
        const extract = (tag: string) => [...text.matchAll(new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/${tag}>|<${tag}>([^<]+)<\\/${tag}>`, "g"))].map(m => (m[1] || m[2] || "").trim());
        const titles = extract("title");
        const places = extract("place");
        const starts = extract("startDate");
        const ends = extract("endDate");
        const realms = extract("realmName");

        if (titles.length > 0) {
          const items = titles.map((title, i) => ({
            title,
            addr1: places[i] || region,
            firstimage: IMG.perf,
            eventstartdate: (starts[i] || from).replace(/-/g, ""),
            eventenddate: (ends[i] || to).replace(/-/g, ""),
            cat: realms[i] || "공연/전시"
          })).filter(f => f.title);
          if (items.length > 0) {
            return NextResponse.json({ festivals: items, trails: [], debug: { source: "culture", region, month } }, { headers: corsHeaders });
          }
        }
      }
    }
  } catch (_) { /* 문화포털 실패 - 목데이터 사용 */ }

  // 3차: 목데이터 (항상 성공 보장)
  return NextResponse.json({
    festivals: getMockFestivals(region, month),
    trails: [],
    debug: { source: "mock", region, month }
  }, { headers: corsHeaders });
}

function getMockFestivals(region: string, month: string) {
  const d = (title: string, addr1: string, img: string, s: string, e: string, cat: string) =>
    ({ title, addr1, firstimage: img, eventstartdate: s, eventenddate: e, cat });

  const all = [
    // 서울
    d("성수 팝업 스토어 위크", "서울특별시 성동구 성수동", IMG.popup, "20260501", "20260531", "팝업"),
    d("국립현대미술관 기획전", "서울특별시 종로구 국립현대미술관", IMG.exhibit, "20260401", "20260630", "전시"),
    d("한강 달빛 야시장", "서울특별시 서초구 반포한강공원", IMG.event, "20260501", "20261028", "행사"),
    d("서울 재즈 페스티벌", "서울특별시 송파구 올림픽공원", IMG.perf, "20260523", "20260525", "공연"),
    d("서울 장미축제", "서울특별시 중랑구 중랑천변", IMG.flower, "20260525", "20260601", "축제"),
    d("홍대 버스킹 위크", "서울특별시 마포구 홍대입구역", IMG.perf, "20260601", "20260615", "공연"),
    d("DDP 디자인 팝업", "서울특별시 중구 동대문디자인플라자", IMG.popup, "20260601", "20260630", "팝업"),

    // 경기
    d("수원 화성 행궁 야간개장", "경기도 수원시 팔달구", IMG.event, "20260501", "20261031", "행사"),
    d("파주 헤이리 예술마을 전시", "경기도 파주시 탄현면 헤이리", IMG.exhibit, "20260401", "20260630", "전시"),
    d("판교 팝업 페어", "경기도 성남시 분당구 판교", IMG.popup, "20260501", "20260531", "팝업"),
    d("고양 꽃박람회", "경기도 고양시 일산서구 킨텍스", IMG.flower, "20260426", "20260510", "행사"),
    d("용인 에버랜드 장미축제", "경기도 용인시 처인구", IMG.flower, "20260501", "20260630", "축제"),
    d("가평 자라섬 뮤직 행사", "경기도 가평군 자라섬", IMG.perf, "20260501", "20260531", "공연"),

    // 인천
    d("인천 개항장 문화 야행", "인천광역시 중구 개항장", IMG.event, "20260501", "20260630", "행사"),
    d("송도 센트럴파크 팝업마켓", "인천광역시 연수구 송도동", IMG.popup, "20260501", "20260531", "팝업"),
    d("인천아트플랫폼 기획전", "인천광역시 중구 해안동", IMG.exhibit, "20260401", "20260630", "전시"),
    d("강화 고려산 진달래 축제", "인천광역시 강화군 고려산", IMG.flower, "20260415", "20260424", "축제"),
    d("인천 버스킹 인 항구", "인천광역시 중구 내항", IMG.perf, "20260501", "20260531", "공연"),

    // 강원
    d("춘천 마임 축제", "강원도 춘천시 공지천", IMG.fest, "20260520", "20260528", "축제"),
    d("속초 등대 야시장", "강원도 속초시 동명동", IMG.event, "20260601", "20260831", "행사"),
    d("춘천 레고랜드 봄 팝업", "강원도 춘천시 레고랜드", IMG.popup, "20260501", "20260630", "팝업"),
    d("강릉 해변 버스킹", "강원도 강릉시 경포해변", IMG.perf, "20260601", "20260831", "공연"),
    d("강릉 커피 축제", "강원도 강릉시 강릉항", IMG.coffee, "20261005", "20261010", "축제"),
    d("원주 뮤지엄 산 전시", "강원도 원주시 지정면 뮤지엄 산", IMG.exhibit, "20260401", "20261031", "전시"),

    // 충북
    d("청주 육거리 전통시장 행사", "충청북도 청주시 서원구", IMG.event, "20260501", "20260531", "행사"),
    d("청주 팝업스토어 페어", "충청북도 청주시 흥덕구", IMG.popup, "20260601", "20260630", "팝업"),
    d("청주 공예 비엔날레", "충청북도 청주시 상당구 문화제조창", IMG.exhibit, "20261001", "20261031", "전시"),
    d("충주 탄금대 봄꽃 행사", "충청북도 충주시 탄금대", IMG.flower, "20260401", "20260430", "행사"),
    d("제천 의림지 버스킹", "충청북도 제천시 의림지", IMG.perf, "20260501", "20260531", "공연"),

    // 충남/대전/세종
    d("공주 공산성 밤마실", "충청남도 공주시 금성동", IMG.event, "20260501", "20260630", "행사"),
    d("천안 독립기념관 기획전", "충청남도 천안시 동남구", IMG.exhibit, "20260301", "20260531", "전시"),
    d("대전 엑스포 시민광장 공연", "대전광역시 서구 둔산동", IMG.perf, "20260501", "20260531", "공연"),
    d("대전 성심당 팝업 행사", "대전광역시 중구 은행동", IMG.popup, "20260501", "20260630", "팝업"),
    d("대전 으능정이 거리 버스킹", "대전광역시 중구 으능정이", IMG.perf, "20260601", "20260831", "공연"),
    d("논산 딸기 축제", "충청남도 논산시 강경읍", IMG.flower, "20260301", "20260331", "축제"),

    // 전북
    d("전주 한옥마을 버스킹", "전라북도 전주시 완산구 한옥마을", IMG.perf, "20260401", "20261031", "공연"),
    d("전주 팝업 공예시장", "전라북도 전주시 완산구 전주객사", IMG.popup, "20260501", "20260531", "팝업"),
    d("군산 근대역사 행사", "전라북도 군산시 월명동", IMG.event, "20260501", "20260531", "행사"),
    d("전주 비빔밥 축제", "전라북도 전주시 완산구", IMG.fest, "20261001", "20261005", "축제"),
    d("전북 문화재 야행", "전라북도 전주시 완산구", IMG.event, "20260601", "20260630", "행사"),

    // 전남/광주
    d("담양 대나무 축제", "전라남도 담양군 담양읍", IMG.bamboo, "20260501", "20260505", "축제"),
    d("광주 비엔날레 기획전", "광주광역시 북구 용봉동", IMG.exhibit, "20260401", "20260709", "전시"),
    d("광주 동명동 카페거리 팝업", "광주광역시 동구 동명동", IMG.popup, "20260501", "20260630", "팝업"),
    d("여수 거북선 축제", "전라남도 여수시 이순신광장", IMG.fest, "20260501", "20260504", "축제"),
    d("순천만 봄 생태 행사", "전라남도 순천시 순천만", IMG.event, "20260401", "20260531", "행사"),
    d("광주 충장 버스킹", "광주광역시 동구 충장로", IMG.perf, "20260501", "20260531", "공연"),

    // 대구/경북
    d("대구 이월드 수국 축제", "대구광역시 달서구 두류공원", IMG.flower, "20260501", "20260630", "축제"),
    d("대구 수성못 버스킹", "대구광역시 수성구 수성못", IMG.perf, "20260401", "20261031", "공연"),
    d("대구 동성로 팝업스토어", "대구광역시 중구 동성로", IMG.popup, "20260501", "20260531", "팝업"),
    d("대구 국제뮤지컬 페스티벌", "대구광역시 달서구 계명아트센터", IMG.perf, "20260601", "20260630", "공연"),
    d("대구 근대골목 투어 행사", "대구광역시 중구 근대골목", IMG.event, "20260401", "20260831", "행사"),
    d("경주 황리단길 버스킹", "경상북도 경주시 황남동", IMG.perf, "20260401", "20261031", "공연"),
    d("안동 탈춤 페스티벌", "경상북도 안동시 낙동강변", IMG.fest, "20261001", "20261010", "축제"),

    // 부산/울산/경남
    d("부산 모래축제", "부산광역시 해운대구 해운대해수욕장", IMG.beach, "20260520", "20260523", "축제"),
    d("부산 영화의전당 기획전시", "부산광역시 해운대구 영화의전당", IMG.exhibit, "20260501", "20260630", "전시"),
    d("광안리 버스킹 시즌", "부산광역시 수영구 광안리해수욕장", IMG.perf, "20260401", "20261031", "공연"),
    d("서면 팝업스토어 마켓", "부산광역시 부산진구 서면", IMG.popup, "20260501", "20260531", "팝업"),
    d("울산 태화강 봄꽃 축제", "울산광역시 중구 태화강국가정원", IMG.flower, "20260415", "20260520", "축제"),
    d("창원 군항제", "경상남도 창원시 진해구 경화역", IMG.flower, "20260401", "20260410", "축제"),
    d("부산 야시장", "부산광역시 남구 용호동", IMG.event, "20260501", "20260531", "행사"),

    // 제주
    d("제주 빛의 벙커 미디어아트", "제주특별자치도 서귀포시 성산읍", IMG.light, "20260101", "20261231", "전시"),
    d("애월 팝업 마켓", "제주특별자치도 제주시 애월읍", IMG.popup, "20260501", "20260630", "팝업"),
    d("제주 버스킹 인 이호테우", "제주특별자치도 제주시 이호동", IMG.perf, "20260601", "20260831", "공연"),
    d("제주 벚꽃 봄 행사", "제주특별자치도 제주시 전농로", IMG.flower, "20260401", "20260415", "행사"),
    d("제주 산수국 축제", "제주특별자치도 서귀포시 중문관광단지", IMG.bamboo, "20260701", "20260731", "축제"),
    d("제주 들불 축제", "제주특별자치도 제주시 봉개동", IMG.fest, "20260301", "20260310", "축제"),
  ];

  const filtered = all.filter(f => !region || region === "전국" || f.addr1.includes(region));
  const byMonth = filtered.filter(f => {
    const s = parseInt(f.eventstartdate.substring(4, 6));
    const e = parseInt(f.eventenddate.substring(4, 6));
    const t = parseInt(month);
    return t >= s && t <= e;
  });
  return byMonth;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profile = {}, taste = {}, condition = {}, festivals = [] } = body;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: "생성 실패", details: "GEMINI_API_KEY 없음" }, { status: 500, headers: corsHeaders });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    const myAge = profile.myAge || "20";
    const partnerAge = profile.partnerAge || "20";
    const regionName = condition.지역 || "전국";
    const subRegion = condition.세부지역 || "전체";
    const region = (regionName === "전국" || regionName === "완전 랜덤 🎲" || subRegion === "전체") 
      ? regionName 
      : `${regionName} ${subRegion}`;
    const stamina = condition.체력 || "보통";
    const budget = condition.예산 || "적당히";
    const mood = Array.isArray(taste.무드) ? taste.무드.join(", ") : "";
    const activity = Array.isArray(taste.활동) ? taste.활동.join(", ") : "";
    const limitedFestivals = Array.isArray(festivals) ? festivals.slice(0, 10) : [];
    const festivalInfo = limitedFestivals.length > 0
      ? `현재 지역 축제/팝업/전시: ${limitedFestivals.map((f: any) => `${f.title}(${f.addr1 || ""})`).join(", ")}`
      : "";

    const prompt = `당신은 사용자가 "기억하게 될 하루의 감정과 장면"을 설계하는 로컬 문화 경험 큐레이터입니다.
고유 ID: ${Date.now()}

[핵심 미션]
1. 창의성과 다양성: 전시, 시골축제, 팝업스토어 등 독특하고 이색적인 로컬 경험을 적극적으로 추천하세요. 매번 전혀 다른 장소와 테마를 제안해야 합니다.
2. 활동의 믹스매치: 사용자가 여러 개의 '취향 활동'을 선택했다면 한 가지 활동에만 치우치지 마세요. (예: '걷기'만 3번 시키지 말고, 걷기+전시+카페 등 선택된 활동들을 장면 1, 2, 3에 조화롭게 섞어주세요.)
3. 능동적 액션: 커플/친구끼리 즐길 수 있는 내기, 미션, DIY, 사진 기록, 이색 대결 등 체험형 활동을 반드시 포함.
4. 동선과 거리 감각 (매우 중요): '이동수단'에 맞춰 장소 간 거리를 현실적으로 짜주세요.
   - "도보 (한 동네)": 3개의 장소가 모두 같은 동네, 걸어서 이동 가능한 아주 가까운 거리여야 합니다.
   - "대중교통": 버스나 지하철로 환승이 적고 이동이 편한 노선으로 구성하세요.
   - "자차": 약간 거리가 있어도 괜찮지만 주차 편의성을 고려하세요.
5. 지역 설정: 만약 지역이 "완전 랜덤 🎲"이라면, 전국구 중에서 당신이 임의로 한 곳의 매력적인 세부 지역(예: 경주 황리단길, 제주 애월 등)을 골라 코스를 짜주세요.
6. 축제/팝업 활용: ${festivalInfo ? "제시된 정보를 코스에 자연스럽게 녹여내세요." : "그 지역 독특한 로컬 경험을 제안하세요."}

[입력 정보]
- 지역: ${region}, 체력: ${stamina}, 예산: ${budget}, 이동수단: ${condition.이동수단 || "미정"}
- 동행: ${myAge}대와 ${partnerAge}대, 취향: ${mood}, ${activity}
${festivalInfo}

[출력 형식 (JSON만 반환)]
{
  "theme": "[감성적 묘사] [장소명]에서",
  "desc": "그날의 분위기 한 줄",
  "emoji": "아이콘",
  "vibe": ["#태그1", "#태그2", "#태그3"],
  "doThis": [
    { "title": "장면 1: 시작", "desc": "01 구체적인 행동" },
    { "title": "장면 2: 몰입", "desc": "02 함께 수행할 미션" },
    { "title": "장면 3: 여운", "desc": "03 마무리 활동" }
  ],
  "funTip": "꿀팁",
  "randomTwist": "엉뚱한 아이디어",
  "talkTopic": "나누기 좋은 질문",
  "nearby": [{ "name": "장소명", "type": "카페/식당/명소", "reason": "추천 이유", "emoji": "아이콘" }],
  "nextTheme": { "title": "다음 추천 테마", "desc": "설명", "isReservationRequired": false },
  "duration": "소요 시간",
  "bestTime": "추천 시간대",
  "transportInfo": "자차면 주차 정보, 뚜벅이면 대중교통 팁 1~2문장"
}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 1.0, responseMimeType: "application/json" }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "생성 실패", details: `Gemini: ${res.status} ${errText}` }, { status: 500, headers: corsHeaders });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    if (!cleanJson.theme) throw new Error("유효하지 않은 응답: " + text);

    return NextResponse.json(cleanJson, { headers: corsHeaders });
  } catch (e: any) {
    console.error("AI Error:", e);
    return NextResponse.json({ error: "생성 실패", details: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
