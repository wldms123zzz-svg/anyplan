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
    const targetYear = today.getFullYear();
    const targetMonth = month || (today.getMonth() + 1);
    const targetMonthStr = String(targetMonth).padStart(2, "0");
    const startDate = `${targetYear}${targetMonthStr}01`;

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaCode = AREA_CODES[region] || "";
    const areaParam = areaCode ? `&areaCode=${areaCode}` : "";
    
    // 1차 시도: searchFestival2 (월별 축제 전용 API)
    let tourUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${startDate}&numOfRows=50${areaParam}`;
    let res = await fetch(tourUrl);
    let data = await res.json();
    let items = data?.response?.body?.items?.item || [];

    // 2차 시도: 만약 축제가 없다면 areaBasedList2 (일반 행사/전시)로 확장하되, 나중에 수동 필터링
    if (!Array.isArray(items) || items.length === 0) {
      tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=100&listYN=Y&arrange=Q${areaParam}`;
      res = await fetch(tourUrl);
      data = await res.json();
      items = data?.response?.body?.items?.item || [];
    }

    // 결과 필터링: 선택한 '월'에 해당하는 데이터만 엄격하게 선별
    if (Array.isArray(items)) {
      items = items.filter((item: any) => {
        // searchFestival2는 eventstartdate가 있고, areaBasedList2는 없을 수 있음
        // 하지만 contentTypeId=15인 경우 대부분 기간 정보가 존재함
        const start = item.eventstartdate || "";
        const end = item.eventenddate || "";
        
        // 시작월이 일치하거나, 해당 월이 행사 기간(시작~종료) 사이에 포함되는지 확인
        const isStartInMonth = start.substring(4, 6) === targetMonthStr;
        const isMonthInRange = start <= `${targetYear}${targetMonthStr}31` && end >= `${targetYear}${targetMonthStr}01`;
        
        return isStartInMonth || isMonthInRange;
      }).map((item: any) => ({
        title: item.title,
        addr1: item.addr1,
        firstimage: item.firstimage,
        eventstartdate: item.eventstartdate || "",
        eventenddate: item.eventenddate || ""
      }));
    }

    // 최대 10개까지만 반환
    const resultItems = Array.isArray(items) ? items.slice(0, 10) : [];

    const result = NextResponse.json(resultItems);
    result.headers.set("Access-Control-Allow-Origin", "*");
    return result;
  } catch (error) {
    console.error("Festival API Error:", error);
    return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 500 });
  }
}
