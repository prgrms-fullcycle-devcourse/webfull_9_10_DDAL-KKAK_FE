import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 라우트 변경 시 스크롤을 맨 위로 올림.
 * React Router v6는 기본적으로 스크롤 위치를 보존하지 않지만 (즉, 새 페이지에 그대로
 * 이전 페이지의 스크롤 좌표가 따라옴), 사용자가 긴 페이지의 하단에서 다른 페이지로
 * 이동했을 때 새 페이지가 중간/하단부터 보여서 혼란을 줄 수 있음.
 * App 루트에 한 번만 마운트해두면 모든 navigate에 대해 동작.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return null;
}
