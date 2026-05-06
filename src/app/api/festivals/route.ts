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

    // [전략] 2026년 팝업, 전시, 축제를 위한 다중 채널 검색
    const [festItems, popupItems, exhibitionItems, areaItems] = await Promise.all([
      // 1. 공식 축제 (2026년)
      fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${decodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${targetYear}${targetMonthStr}01&numOfRows=50${areaParam}`),
      // 2. 팝업 키워드 검색
      fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${decodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(targetYear + " " + region + " 팝업")}&numOfRows=30`),
      // 3. 전시 키워드 검색 (문화시설 카테고리 14 포함)
      fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${decodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&keyword=${encodeURIComponent(targetYear + " " + region + " 전시")}&contentTypeId=14&numOfRows=30`),
      // 4. 일반 행사 리스트
      fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${decodedKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=100&arrange=Q${areaParam}`)
    ]);

    const combined = [...festItems, ...popupItems, ...exhibitionItems, ...areaItems].filter(i => i && i.title);

    // [Strict Filter] 2026년 & 해당 월 매칭
    const filtered = combined.filter((item: any) => {
      const start = item.eventstartdate || "";
      const end = item.eventenddate || "";
      const title = item.title || "";

      // 1. 2026년 데이터인지 확인 (날짜 혹은 제목)
      const is2026 = start.startsWith(targetYear) || end.startsWith(targetYear) || title.includes(targetYear);
      if (!is2026) return false;

      // 2. 해당 월에 포함되는지 확인
      const startMonth = start.substring(4, 6);
      const endMonth = end.substring(4, 6);
      const isInMonth = startMonth === targetMonthStr || endMonth === targetMonthStr || 
                        (start <= `${targetYear}${targetMonthStr}31` && end >= `${targetYear}${targetMonthStr}01`) ||
                        (title.includes(targetMonth + "월")); // 제목에 "n월" 포함된 경우

      return isInMonth;
    });

    if (filtered.length === 0) {
      return NextResponse.json({ message: `현재 2026년 ${targetMonth}월에는 ${region}에 예정된 팝업, 전시, 축제 정보가 아직 API에 등록되지 않았습니다. 🥲` });
    }

    const seenTitles = new Set();
    const resultItems = filtered.filter(item => {
      if (!item.title || seenTitles.has(item.title)) return false;
      seenTitles.add(item.title);
      return true;
    }).slice(0, 20).map((item: any) => ({
      title: item.title,
      addr1: item.addr1,
      firstimage: item.firstimage,
      eventstartdate: item.eventstartdate || "2026" + targetMonthStr + "01",
      eventenddate: item.eventenddate || item.eventstartdate || "2026" + targetMonthStr + "28"
    }));

    return NextResponse.json(resultItems);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
