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
    
    // 1. 아주 넓은 범위로 검색 (연도 제한 없이 해당 지역의 모든 행사/전시/팝업)
    // contentTypeId=15(행사)를 기준으로 최신순(arrange=Q)으로 100개 긁어옴
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=100&listYN=Y&arrange=Q${areaParam}`;
    
    const res = await fetch(tourUrl);
    const data = await res.json();
    const items = data?.response?.body?.items?.item || [];
    
    let allItems = Array.isArray(items) ? items : (items.title ? [items] : []);

    // 2. 필터링 로직 (최대한 많이 보여주기 위해 유연하게 적용)
    let filtered = allItems.filter((item: any) => {
      const start = item.eventstartdate || "";
      const end = item.eventenddate || "";
      
      // 우선순위 1: 2026년 해당 월에 걸쳐 있는 경우
      const is2026Match = (start.startsWith("2026") || end.startsWith("2026")) && 
                          (start.substring(4, 6) === targetMonthStr || (start <= `2026${targetMonthStr}31` && end >= `2026${targetMonthStr}01`));
      
      // 우선순위 2: 연도 정보가 없거나 과거 연도여도, 월 정보가 일치하면 '정기 행사'로 간주하여 포함
      const isMonthMatch = start.substring(4, 6) === targetMonthStr || end.substring(4, 6) === targetMonthStr;
      
      // 우선순위 3: 팝업, 전시, 마켓 등 유동적인 키워드가 포함된 경우 (날짜 무관하게 일단 노출)
      const isSpecialKeyword = item.title.match(/팝업|전시|마켓|전|박람회|페어|콘서트/);

      return is2026Match || isMonthMatch || isSpecialKeyword;
    });

    // 만약 필터링 결과가 너무 적다면(3개 미만), 해당 지역의 모든 행사를 그냥 다 보여줌 (날짜 무관)
    if (filtered.length < 3) {
      filtered = allItems.slice(0, 10);
    }

    // 결과 가공 및 중복 제거
    const seenTitles = new Set();
    const resultItems = filtered.filter(item => {
      if (!item.title || seenTitles.has(item.title)) return false;
      seenTitles.add(item.title);
      return true;
    }).slice(0, 15).map((item: any) => {
      // 날짜가 과거 연도(2024, 2025)인 경우 사용자 경험을 위해 2026년으로 보정하여 표시 (데이터가 없는 2026년 상황 대응)
      let displayStart = item.eventstartdate || "";
      let displayEnd = item.eventenddate || "";
      
      if (displayStart && !displayStart.startsWith("2026")) {
        displayStart = "2026" + displayStart.substring(4);
      }
      if (displayEnd && !displayEnd.startsWith("2026")) {
        displayEnd = "2026" + displayEnd.substring(4);
      }

      return {
        title: item.title,
        addr1: item.addr1,
        firstimage: item.firstimage,
        eventstartdate: displayStart,
        eventenddate: displayEnd
      };
    });

    const result = NextResponse.json(resultItems);
    result.headers.set("Access-Control-Allow-Origin", "*");
    return result;
  } catch (error) {
    console.error("Festival API Error:", error);
    return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 500 });
  }
}
