import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { region } = await req.json();
    const tourKey = process.env.TOUR_API_KEY;
    
    if (!tourKey) {
      return NextResponse.json({ error: "API 키가 없습니다." }, { status: 500 });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}${month}${day}`;

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaParam = (region && AREA_CODES[region]) ? `&areaCode=${AREA_CODES[region]}` : "";
    // searchFestival2 대신 더 포괄적인 areaBasedList2 (contentTypeId=15: 축제/행사) 사용
    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=10&listYN=Y&arrange=Q${areaParam}`;

    const res = await fetch(tourUrl);
    const data = await res.json();
    const items = data?.response?.body?.items?.item || [];

    const result = NextResponse.json(items);
    result.headers.set("Access-Control-Allow-Origin", "*");
    return result;
  } catch (error) {
    return NextResponse.json({ error: "데이터를 가져오는데 실패했습니다." }, { status: 500 });
  }
}
