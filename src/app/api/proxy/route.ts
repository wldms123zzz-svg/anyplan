import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('areaCode') || '';
    const month = searchParams.get('month') || '';
    const tourKey = process.env.TOUR_API_KEY;

    if (!tourKey) return NextResponse.json({ error: 'Missing Tour API Key' }, { status: 500 });

    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    const areaCode = AREA_CODES[region] || "";
    // 여러 타입을 병렬로 가져와서 합침 (15: 축제, 14: 문화시설/전시, 12: 관광지)
    const fetchItems = async (contentTypeId: string) => {
      try {
        const url = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=30&contentTypeId=${contentTypeId}&arrange=Q`;
        const res = await fetch(url);
        const d = await res.json();
        return d?.response?.body?.items?.item || [];
      } catch (e) { return []; }
    };

    const [festItems, cultureItems] = await Promise.all([
      fetchItems("15"), // 축제/행사
      fetchItems("14")  // 전시/문화시설
    ]);

    const combined = [
      ...(Array.isArray(festItems) ? festItems : (festItems ? [festItems] : [])),
      ...(Array.isArray(cultureItems) ? cultureItems : (cultureItems ? [cultureItems] : []))
    ].filter(i => i && (i.title || i.addr1));

    return NextResponse.json({ festivals: combined.sort(() => 0.5 - Math.random()) }, {
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error: any) {
    console.error("Festival API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profile, taste, condition } = body;
    
    const tourKey = process.env.TOUR_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const cultureKey = process.env.CULTURE_API_KEY || tourKey;
    const durunubiKey = process.env.DURUNUBI_API_KEY || tourKey;

    if (!tourKey || !geminiKey) {
      return NextResponse.json({ error: 'Missing Essential API Keys' }, { status: 500 });
    }

    const currentRegion = condition.지역 || "전국";
    const AREA_CODES: Record<string, string> = {
      "서울": "1", "인천": "2", "대전": "3", "대구": "4", "광주": "5", "부산": "6", "울산": "7", "세종": "8",
      "경기": "31", "강원": "32", "충북": "33", "충남": "34", "경북": "35", "경남": "36", "전북": "37", "전남": "38", "제주": "39"
    };
    
    const areaCode = AREA_CODES[currentRegion] || "";
    let realData = "";

    // 1. 다양한 공공 데이터 API 병렬 호출 (보안 유지)
    if (areaCode) {
      try {
        const targetYear = new Date().getFullYear();
        const targetMonth = String(new Date().getMonth() + 1).padStart(2, "0");
        const todayStr = `${targetYear}${targetMonth}01`;

        const fetchItems = async (url: string) => {
          try {
            const res = await fetch(url);
            const d = await res.json();
            return d?.response?.body?.items?.item || [];
          } catch (e) { return []; }
        };

        const [festItems, areaItems, cultureItems, duruItems] = await Promise.all([
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&eventStartDate=${todayStr}&areaCode=${areaCode}&numOfRows=10`),
          fetchItems(`https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${tourKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=10&arrange=Q`),
          fetchItems(`https://apis.data.go.kr/B551011/CulturalEventService2/getAreaBasedList2?serviceKey=${cultureKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=10`),
          fetchItems(`https://apis.data.go.kr/B551011/DurunubiService2/courseList?serviceKey=${durunubiKey}&MobileOS=ETC&MobileApp=anyplan&_type=json&areaCode=${areaCode}&numOfRows=10`)
        ]);

        const combined = [
          ...(Array.isArray(festItems) ? festItems : (festItems ? [festItems] : [])),
          ...(Array.isArray(areaItems) ? areaItems : (areaItems ? [areaItems] : [])),
          ...(Array.isArray(cultureItems) ? cultureItems : (cultureItems ? [cultureItems] : [])),
          ...(Array.isArray(duruItems) ? duruItems : (duruItems ? [duruItems] : []))
        ].filter(i => i && (i.title || i.crsNm));
        
        if (combined.length > 0) {
          realData = combined.sort(() => 0.5 - Math.random()).slice(0, 15).map((i: any) => `${i.title || i.crsNm}(${i.addr1 || ""})`).join(", ");
        }
      } catch (e) { console.error("Multi API Error", e); }
    }

    // 2. Gemini AI 호출 (v1 버전 사용)
    const prompt = `
      사용자 정보: 지역(${currentRegion}), 취향(${taste.무드.join(", ")}, ${taste.활동.join(", ")}), 예산(${condition.예산})
      실시간 참고 장소(축제, 팝업, 전시 포함): ${realData || "해당 지역 주요 명소"}

      위 정보를 바탕으로 센스 있는 3단계 데이트 코스를 짜주세요. 
      취향(${taste.활동.join(", ")})이 조화롭게 포함되어야 합니다.
      '커플', '연인' 단어 사용 금지.
      
      반드시 아래 JSON 형식으로만 응답하세요:
      {
        "theme": "코스 제목",
        "emoji": "이모지",
        "vibe": ["#태그1", "#태그2"],
        "desc": "핵심 감성",
        "doThis": ["활동1", "활동2", "활동3"],
        "transportInfo": "이동 팁",
        "talkTopic": "대화 주제",
        "randomTwist": "미션",
        "perfectFor": "추천 대상",
        "nextDate": { "place": "다음 추천", "reason": "이유", "emoji": "이모지" }
      }
    `;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const gData = await geminiRes.json();
    
    if (!geminiRes.ok) {
      console.error("Gemini API Error Response:", JSON.stringify(gData));
      return NextResponse.json({ error: gData.error?.message || "Gemini API Error" }, { status: geminiRes.status });
    }

    let resultText = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Raw Gemini Text:", resultText);

    if (!resultText) {
      return NextResponse.json({ error: "AI가 응답을 생성하지 못했습니다. (Safety Filter 등)" }, { status: 500 });
    }

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) resultText = jsonMatch[0];
    
    try {
      return NextResponse.json(JSON.parse(resultText), {
        headers: { 
          'Access-Control-Allow-Origin': '*', 
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    } catch (e) {
      console.error("JSON Parse Error. Raw Text:", resultText);
      return NextResponse.json({ error: "AI 응답 형식이 올바르지 않습니다.", raw: resultText.slice(0, 100) }, { status: 500 });
    }

  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: { 
      'Access-Control-Allow-Origin': '*', 
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 
      'Access-Control-Allow-Headers': 'Content-Type' 
    }
  });
}
