import { useCallback, useEffect, useRef, useState } from 'react';
import { TossAds, type TossAdsAttachBannerOptions } from '@apps-in-toss/web-framework';

/**
 * Toss 배너 광고 SDK를 초기화하고 배너를 부착할 수 있는 기능을 제공하는 커스텀 훅
 */
export function useTossBanner() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    // SDK 초기화 지원 여부 확인
    if (!TossAds?.initialize?.isSupported?.()) {
      console.warn('이 환경에서는 배너 광고 초기화 기능을 사용할 수 없습니다.');
      return;
    }

    // SDK 초기화
    TossAds?.initialize?.({
      callbacks: {
        onInitialized: () => {
          console.log('Toss Ads SDK 초기화 완료');
          setIsInitialized(true);
        },
        onInitializationFailed: (error) => {
          console.error('Toss Ads SDK 초기화 실패:', error);
        },
      },
    });
  }, [isInitialized]);

  const attachBanner = useCallback(
    (adGroupId: string, element: HTMLElement, options?: TossAdsAttachBannerOptions) => {
      if (!isInitialized) return;

      // 배너 부착 지원 여부 확인
      if (!TossAds?.attachBanner?.isSupported?.()) {
        console.warn('이 환경에서는 배너 광고 부착 기능을 사용할 수 없습니다.');
        return;
      }

      return TossAds?.attachBanner?.(adGroupId, element, options);
    },
    [isInitialized],
  );

  return { isInitialized, attachBanner };
}

interface BannerAdProps {
  adGroupId: string;
}

/**
 * Toss 배너 광고 컴포넌트
 * @param adGroupId 광고 그룹 ID
 */
export function BannerAd({ adGroupId }: BannerAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isInitialized, attachBanner } = useTossBanner();

  useEffect(() => {
    if (!isInitialized || !containerRef.current) return;

    // 배너 부착
    const attached = attachBanner(adGroupId, containerRef.current, {
      theme: 'auto', // 시스템 설정에 따라 라이트/다크 자동 전환
      tone: 'blackAndWhite', // 배경 톤 설정
      variant: 'expanded', // 전체 너비 확장 형태
      callbacks: {
        onAdRendered: (payload) => {
          console.log('광고 렌더링 완료:', payload.slotId);
        },
        onAdViewable: (payload) => {
          console.log('광고 노출 가능:', payload.slotId);
        },
        onAdImpression: (payload) => {
          console.log('광고 노출 기록됨 (수익 발생):', payload.slotId);
        },
        onAdClicked: (payload) => {
          console.log('광고 클릭됨:', payload.slotId);
        },
        onNoFill: (payload) => {
          console.warn('표시할 광고가 없습니다:', payload.slotId);
        },
        onAdFailedToRender: (payload) => {
          console.error('광고 렌더링 실패:', payload.error.message);
        },
      },
    });

    // 클린업: 컴포넌트 언마운트 시 배너 제거
    return () => {
      if (attached) {
        attached.destroy?.();
      }
    };
  }, [isInitialized, adGroupId, attachBanner]);

  // 고정형 배너: width 100% + height 96px 권장
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '96px',
        marginTop: '20px',
        marginBottom: '20px',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: '#f9fafb', // 광고 로딩 전 배경색
      }}
    />
  );
}
