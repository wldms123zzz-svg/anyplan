import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { region, month } = await req.json();
    const tourKey = process.env.TOUR_API_KEY;
    
    if (!tourKey) {
      return NextResponse.json({ error: "Vercel 환경 변수에 TOUR_API_KEY가 없습니다." }, { status: 500 });
    }

    if (!region || region === "전국") {
      return NextResponse.json({ message: "지역을 선택하세요." });
    }

    const targetYear = "2026";
    const targetMonth = month || (new Date().getMonth() + 1);
    const targetMonthStr = String(targetMonth).padStart(2, "0");

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaCode = AREA_CODES[region] || "";
    const areaParam = areaCode ? `&areaCode=${areaCode}` : "";
    
    // 키 인코딩 문제를 해결하기 위해 두 가지 버전을 모두 준비
    const encodedKey = encodeURIComponent(decodeURIComponent(tourKey));

    const fetchItems = async (url: string) => {
      try {
        const res = await fetch(url, { next: { revalidate: 0 } });
        const text = await res.text();
        if (text.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR") || text.includes("SERVICE_KEY_ERROR")) {
          console.error("API Key Error:", text);
          return { error: "API 키 인증 실패" };
        }
        const data = JSON.parse(text);
        const items = data?.response?.body?.items?.item || [];
        return Array.isArray(items) ? items : (items.title ? [items] : []);
      } catch (e) { return []; }
    };

    // [전략] 2026년 데이터를 찾기 위해 3단계로 검색
    // 1. 공식 축제 검색 (2026년 시작 데이터)
    let allItems = await fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonthStr}01&numOfRows=50${areaParam}`);
    
    if (allItems.error) {
      // 인코딩된 키로 재시도
      allItems = await fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${encodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonthStr}01&numOfRows=50${areaParam}`);
    }

    // 2. 키워드 검색 ("2026" + 지역명) - 날짜가 제목에 들어있는 경우 대비
    if (!Array.isArray(allItems) || allItems.length === 0) {
      const keywordItems = await fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(targetYear + " " + region)}&numOfRows=50`);
      allItems = keywordItems;
    }

    // 3. 지역 기반 행사 검색 (가장 넓은 범위)
    if (!Array.isArray(allItems) || allItems.length === 0) {
      allItems = await fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=100&arrange=Q${areaParam}`);
    }

    // [STRICT FILTER] 오직 2026년 데이터만!
    const filtered = (Array.isArray(allItems) ? allItems : []).filter((item: any) => {
      const start = item.eventstartdate || "";
      const end = item.eventenddate || "";
      const title = item.title || "";
      
      // 날짜에 2026이 있거나 제목에 2026이 있는 경우만 인정
      const is2026 = start.startsWith(targetYear) || end.startsWith(targetYear) || title.includes(targetYear);
      if (!is2026) return false;

      // 월 매칭
      const isInMonth = start.substring(4, 6) === targetMonthStr || end.substring(4, 6) === targetMonthStr || 
                        (start <= `${targetYear}${targetMonthStr}31` && end >= `${targetYear}${targetMonthStr}01`);
      
      return isInMonth;
    });

    if (filtered.length === 0) {
      return NextResponse.json({ message: `공공데이터 API에 2026년 ${targetMonth}월 관련 데이터가 아직 등록되지 않았습니다. 🥲` });
    }

    const seenTitles = new Set();
    const resultItems = filtered.filter(item => {
      if (!item.title || seenTitles.has(item.title)) return false;
      seenTitles.add(item.title);
      return true;
    }).slice(0, 15).map((item: any) => ({
      title: item.title,
      addr1: item.addr1,
      firstimage: item.firstimage,
      eventstartdate: item.eventstartdate,
      eventenddate: item.eventenddate || item.eventstartdate
    }));

    return NextResponse.json(resultItems);
  } catch (error: any) {
    return NextResponse.json({ error: "서버 내부 에러" }, { status: 500 });
  }
}
