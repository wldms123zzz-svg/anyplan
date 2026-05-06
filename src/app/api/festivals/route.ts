import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { region, month } = await req.json();
    const rawKey = process.env.TOUR_API_KEY;
    
    // API 키 인코딩/디코딩 방어 로직 (공공데이터 포털 특유의 이슈 해결)
    const tourKey = rawKey ? decodeURIComponent(rawKey) : "";
    
    if (!tourKey) {
      return NextResponse.json({ error: "Vercel에 TOUR_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    if (!region || region === "전국") {
      return NextResponse.json({ message: "지역을 선택하세요." });
    }

    const targetMonth = month || (new Date().getMonth() + 1);
    const targetMonthStr = String(targetMonth).padStart(2, "0");

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaCode = AREA_CODES[region] || "";
    const areaParam = areaCode ? `&areaCode=${areaCode}` : "";
    
    // 3개 채널 동시 호출 (실패 대비)
    const fetchWithLog = async (url: string) => {
      try {
        const res = await fetch(url, { next: { revalidate: 0 } }); // 캐시 방지
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          const items = data?.response?.body?.items?.item || [];
          return Array.isArray(items) ? items : (items.title ? [items] : []);
        } catch (e) {
          // XML 에러 응답인 경우 (예: Service Key Error)
          if (text.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) return { error: "키 미등록 에러" };
          if (text.includes("SERVICE_KEY_ERROR")) return { error: "키 오류" };
          return [];
        }
      } catch (e) {
        return [];
      }
    };

    const [festItems, areaItems] = await Promise.all([
      fetchWithLog(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&eventStartDate=20240101&numOfRows=20${areaParam}`),
      fetchWithLog(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=TodayDate&_type=json&contentTypeId=15&numOfRows=20&arrange=Q${areaParam}`)
    ]);

    // 키 에러 발생 시 즉시 리턴하여 화면에 표시
    if (festItems.error) return NextResponse.json({ error: `공공데이터 API 오류: ${festItems.error}` });

    let combined = [...(Array.isArray(festItems) ? festItems : []), ...(Array.isArray(areaItems) ? areaItems : [])];

    if (combined.length === 0) {
      return NextResponse.json({ message: `${region} 지역의 ${targetMonth}월 축제 정보를 찾을 수 없습니다. (API 응답 없음)` });
    }

    const seenTitles = new Set();
    const resultItems = combined.filter(item => {
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

    return NextResponse.json(resultItems);
  } catch (error: any) {
    return NextResponse.json({ error: `서버 내부 에러: ${error.message}` }, { status: 500 });
  }
}
