import { useEffect, useState } from 'react';
import './WorldClocks.css';

const CITIES = [
  { name: 'New York',  country: 'USA',   tz: 'America/New_York' },
  { name: 'London',    country: 'UK',    tz: 'Europe/London'     },
  { name: 'Shanghai',  country: 'China', tz: 'Asia/Shanghai'     },
  { name: 'Abu Dhabi', country: 'UAE',   tz: 'Asia/Dubai'        },
];

export default function WorldClocks() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="world-clocks">
      {CITIES.map(({ name, country, tz }) => (
        <div key={name} className="clock-item">
          <span className="clock-city">{name}, {country}</span>
          <span className="clock-time">
            {now.toLocaleTimeString('en-US', {
              timeZone:  tz,
              hour:      '2-digit',
              minute:    '2-digit',
              second:    '2-digit',
              hour12:    false,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
