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
    const startDate = `${targetYear}${String(targetMonth).padStart(2, "0")}01`;

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaParam = (region && AREA_CODES[region]) ? `&areaCode=${AREA_CODES[region]}` : "";
    
    // 특정 월의 축제 조회를 위해 searchFestival2 사용
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=${startDate}&numOfRows=20${areaParam}`;

    const res = await fetch(tourUrl);
    const data = await res.json();
    let items = data?.response?.body?.items?.item || [];

    // 해당 월에 속하는 것만 필터링 (startDate는 이후 정보를 다 가져오므로)
    if (Array.isArray(items)) {
      items = items.filter((item: any) => {
        const start = item.eventstartdate; // YYYYMMDD
        return start.substring(4, 6) === String(targetMonth).padStart(2, "0");
      });
    }

    const result = NextResponse.json(items);
    result.headers.set("Access-Control-Allow-Origin", "*");
    return result;
  } catch (error) {
    return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 500 });
  }
}
