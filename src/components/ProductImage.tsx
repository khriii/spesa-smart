import { Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
  showFallbackTitle?: boolean;
  useProxy?: boolean;
  eager?: boolean;
  thumbWidth?: number;
}

export function ProductImage({
  src,
  alt,
  className = 'h-full w-full object-contain p-3',
  fallbackClassName = 'flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center',
  iconClassName = 'h-8 w-8 stroke-[1.5]',
  showFallbackTitle = false,
  useProxy = true,
  eager = true,
  thumbWidth = 360,
}: ProductImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(eager);
  const [stage, setStage] = useState<'proxy' | 'direct' | 'failed'>('proxy');

  useEffect(() => {
    if (eager) {
      setInView(true);
      return;
    }
    if (inView) return;

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '650px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, inView]);

  useEffect(() => {
    if (!src) {
      setStage('failed');
    } else if (useProxy && src.startsWith('https://')) {
      setStage('proxy');
    } else {
      setStage('direct');
    }
  }, [src, useProxy]);

  if (!src || stage === 'failed') {
    return (
      <div
        ref={containerRef}
        className={`${fallbackClassName} bg-[var(--surface-subtle)] text-[var(--text-muted)]`}
      >
        <Package className={iconClassName} aria-hidden="true" />
        {showFallbackTitle && (
          <span className="line-clamp-2 text-xs font-medium text-[var(--text-secondary)]">
            {alt}
          </span>
        )}
      </div>
    );
  }

  if (!inView) {
    return (
      <div
        ref={containerRef}
        aria-hidden="true"
        className="h-full w-full bg-[var(--surface-subtle)]/70"
      />
    );
  }

  const resolvedSrc =
    stage === 'proxy'
      ? `/api/image?url=${encodeURIComponent(src)}&w=${thumbWidth}`
      : src;

  return (
    <div ref={containerRef} className="h-full w-full">
      <img
        src={resolvedSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onError={() => {
          if (stage === 'proxy') {
            setStage('direct');
          } else {
            setStage('failed');
          }
        }}
        className={className}
      />
    </div>
  );
}
