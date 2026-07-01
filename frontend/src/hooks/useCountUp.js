import { useEffect, useRef, useState } from 'react';

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    const end = parseFloat(target) || 0;
    const diff = end - start;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else {
        setValue(end);
        prevTarget.current = end;
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

export default useCountUp;