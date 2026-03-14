import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type Params = {
  designWidth: number;
  designHeight: number;
};

export function useViewportScale({ designWidth, designHeight }: Params) {
  const [viewportSize, setViewportSize] = useState({ width: designWidth, height: designHeight });

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);

    return () => {
      window.removeEventListener('resize', updateViewportSize);
    };
  }, []);

  const pageScale = useMemo(() => {
    const widthScale = viewportSize.width / designWidth;
    const heightScale = viewportSize.height / designHeight;
    return Math.min(widthScale, heightScale);
  }, [designHeight, designWidth, viewportSize.height, viewportSize.width]);

  const scaleLayerStyle = useMemo(() => {
    const supportsCssZoom =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('zoom', '1');

    return supportsCssZoom
      ? ({ zoom: pageScale } as CSSProperties)
      : ({ transform: `scale(${pageScale})` } as CSSProperties);
  }, [pageScale]);

  const canvasAnchorStyle = useMemo(() => {
    const scaledWidth = designWidth * pageScale;
    const scaledHeight = designHeight * pageScale;
    const offsetX = Math.max(0, (viewportSize.width - scaledWidth) / 2);
    const offsetY = Math.max(0, (viewportSize.height - scaledHeight) / 2);

    return {
      '--ab-offset-x': `${offsetX / pageScale}px`,
      '--ab-offset-y': `${offsetY / pageScale}px`,
      '--ab-page-scale': `${pageScale}`,
    } as CSSProperties;
  }, [designHeight, designWidth, pageScale, viewportSize.height, viewportSize.width]);

  return {
    pageScale,
    scaleLayerStyle,
    canvasAnchorStyle,
  };
}
