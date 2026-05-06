import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { region, month } = await req.json();
    const tourKey = process.env.TOUR_API_KEY;
    const decodedKey = tourKey ? decodeURIComponent(tourKey) : "";
    
    if (!decodedKey) {
      return NextResponse.json({ error: "API 키 설정 필요" }, { status: 500 });
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
    
    const fetchItems = async (url: string) => {
      try {
        const res = await fetch(url, { next: { revalidate: 0 } });
        const data = await res.json();
        const items = data?.response?.body?.items?.item || [];
        return Array.isArray(items) ? items : (items.title ? [items] : []);
      } catch (e) { return []; }
    };

    // [STRICT] 오직 2026년 데이터만 검색
    let allItems = await fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${decodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonthStr}01&numOfRows=100${areaParam}`);

    // 축제 데이터가 없으면 같은 조건으로 키워드 검색 (2026년 전시, 팝업 등 포함)
    if (allItems.length === 0) {
      allItems = await fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${decodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=100&arrange=Q${areaParam}`);
    }

    // [STRICT FILTER] 연도(2026)와 월(TargetMonth)이 완벽히 일치하는 것만 필터링
    const filtered = allItems.filter((item: any) => {
      const start = item.eventstartdate || "";
      const end = item.eventenddate || "";
      
      // 1. 반드시 2026년 데이터여야 함
      const is2026 = start.startsWith(targetYear) || end.startsWith(targetYear);
      if (!is2026) return false;

      // 2. 반드시 해당 월에 포함되어야 함
      const startMonth = start.substring(4, 6);
      const endMonth = end.substring(4, 6);
      const isInMonth = startMonth === targetMonthStr || endMonth === targetMonthStr || 
                        (start <= `${targetYear}${targetMonthStr}31` && end >= `${targetYear}${targetMonthStr}01`);
      
      return isInMonth;
    });

    if (filtered.length === 0) {
      return NextResponse.json({ message: `현재 2026년 ${targetMonth}월에는 해당 지역에 예정된 공식 행사가 없습니다. 🥲` });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
