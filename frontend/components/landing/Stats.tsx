import { useState, useEffect, useRef } from "react";

const stats = [
  { label: "Organizations", value: 200 },
  { label: "Active Employees", value: 5000 },
  { label: "Payslips Generated", value: 12500 },
  { label: "HR Administrators", value: 350 },
];

export function Stats() {
  const [displayValues, setDisplayValues] = useState(stats.map(() => 0));
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!ref.current || hasAnimated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          stats.forEach((stat, index) => {
            let start = 0;
            const duration = 2000;
            const stepTime = Math.abs(Math.floor(duration / stat.value));

            const timer = setInterval(() => {
              start += 1;
              setDisplayValues((prev) => {
                const newValues = [...prev];
                newValues[index] = start;
                return newValues;
              });

              if (start === stat.value) clearInterval(timer);
            }, stepTime);

            // Cleanup timer
            setTimeout(() => clearInterval(timer), duration + 100);
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section ref={ref} className="py-20 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="space-y-2">
              <div className="text-5xl md:text-6xl font-bold tracking-tight">
                {displayValues[index].toLocaleString()}+
              </div>
              <div className="text-lg md:text-xl text-primary/80 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
