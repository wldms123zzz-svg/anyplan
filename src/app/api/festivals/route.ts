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
    
    // 연도에 상관없이 데이터를 가져오기 위해, 현재 연도뿐만 아니라 직전 연도 데이터도 검색 시도
    const yearsToTry = [2026, 2025, 2024];
    let allItems: any[] = [];

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaCode = AREA_CODES[region] || "";
    const areaParam = areaCode ? `&areaCode=${areaCode}` : "";

    for (const year of yearsToTry) {
      const startDate = `${year}${targetMonthStr}01`;
      const tourUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${startDate}&numOfRows=50${areaParam}`;
      
      try {
        const res = await fetch(tourUrl);
        const data = await res.json();
        const items = data?.response?.body?.items?.item || [];
        if (Array.isArray(items)) {
          // 해당 월에 시작하거나 진행 중인 것만 필터링
          const filtered = items.filter((item: any) => {
            const start = item.eventstartdate || "";
            return start.substring(4, 6) === targetMonthStr;
          });
          allItems = [...allItems, ...filtered];
        } else if (items.title) { // 단일 아이템인 경우
          if (items.eventstartdate?.substring(4, 6) === targetMonthStr) {
            allItems.push(items);
          }
        }
      } catch (e) {
        console.error(`${year}년 데이터 호출 실패:`, e);
      }
      
      if (allItems.length >= 5) break; // 충분히 찾았으면 중단
    }

    // 그래도 없다면 일반 관광지 리스트(areaBasedList2)에서 가져옴
    if (allItems.length === 0) {
      const tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=20&listYN=Y&arrange=Q${areaParam}`;
      const res = await fetch(tourUrl);
      const data = await res.json();
      const items = data?.response?.body?.items?.item || [];
      if (Array.isArray(items)) {
        allItems = items;
      } else if (items.title) {
        allItems = [items];
      }
    }

    // 데이터 가공 및 중복 제거
    const seenTitles = new Set();
    const resultItems = allItems.filter(item => {
      if (seenTitles.has(item.title)) return false;
      seenTitles.add(item.title);
      return true;
    }).slice(0, 10).map((item: any) => ({
      title: item.title,
      addr1: item.addr1,
      firstimage: item.firstimage,
      eventstartdate: item.eventstartdate || "",
      eventenddate: item.eventenddate || ""
    }));

    const result = NextResponse.json(resultItems);
    result.headers.set("Access-Control-Allow-Origin", "*");
    return result;
  } catch (error) {
    console.error("Festival API Error:", error);
    return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 500 });
  }
}
