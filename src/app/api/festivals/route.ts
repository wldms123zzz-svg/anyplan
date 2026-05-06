import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { region, month } = await req.json();
    const tourKey = process.env.TOUR_API_KEY;
    
    if (!tourKey) {
      return NextResponse.json({ error: "API 키가 없습니다." }, { status: 500 });
    }

    if (!region || region === "전국") {
      return NextResponse.json({ message: "지역을 선택하시면 해당 지역의 상세 축제 정보를 보실 수 있습니다." });
    }

    const today = new Date();
    const targetMonth = month || (today.getMonth() + 1);
    const targetMonthStr = String(targetMonth).padStart(2, "0");

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaCode = AREA_CODES[region] || "";
    const areaParam = areaCode ? `&areaCode=${areaCode}` : "";
    
    // 1. 아주 넓은 범위로 검색 (contentTypeId 15: 행사/전시/축제)
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=100&listYN=Y&arrange=Q${areaParam}`;
    
    const res = await fetch(tourUrl);
    const data = await res.json();
    
    // API 응답 구조가 복잡할 수 있으므로 안전하게 추출
    let allItems = data?.response?.body?.items?.item || [];
    if (!Array.isArray(allItems)) {
      allItems = allItems.title ? [allItems] : [];
    }

    // 2. 필터링 로직: 선택한 월에 해당하는 것 위주로 찾되, 없으면 그냥 다 보여줌
    let filtered = allItems.filter((item: any) => {
      const start = item.eventstartdate || "";
      const end = item.eventenddate || "";
      return start.substring(4, 6) === targetMonthStr || end.substring(4, 6) === targetMonthStr || 
             (start <= `2026${targetMonthStr}31` && end >= `2026${targetMonthStr}01`);
    });

    // 필터링 결과가 너무 적으면 전체 리스트에서 10개 강제 추출
    const resultSource = filtered.length > 3 ? filtered : allItems;
    
    const seenTitles = new Set();
    const resultItems = resultSource.filter((item: any) => {
      if (!item.title || seenTitles.has(item.title)) return false;
      seenTitles.add(item.title);
      return true;
    }).slice(0, 15).map((item: any) => ({
      title: item.title,
      addr1: item.addr1,
      firstimage: item.firstimage,
      eventstartdate: item.eventstartdate || "2026" + targetMonthStr + "01",
      eventenddate: item.eventenddate || "2026" + targetMonthStr + "28"
    }));

    const result = NextResponse.json(resultItems);
    result.headers.set("Access-Control-Allow-Origin", "*");
    return result;
  } catch (error) {
    console.error("Festival API Error:", error);
    return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 500 });
  }
}
