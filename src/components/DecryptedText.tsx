import { useEffect, useState, useRef } from 'preact/hooks';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  className?: string;
}

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

export default function DecryptedText({ 
  text, 
  speed = 50,
  className = ''
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const indexRef = useRef(0);
  const iterationRef = useRef(0);

  const decrypt = () => {
    if (intervalRef.current) return;
    
    setIsDecrypting(true);
    indexRef.current = 0;
    iterationRef.current = 0;

    intervalRef.current = window.setInterval(() => {
      const currentIndex = Math.floor(iterationRef.current / 3);
      
      if (currentIndex >= text.length) {
        setDisplayText(text);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsDecrypting(false);
        return;
      }

      const newText = text
        .split('')
        .map((char, index) => {
          if (index < currentIndex) {
            return text[index];
          }
          if (index === currentIndex) {
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          }
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join('');

      setDisplayText(newText);
      iterationRef.current += 1;
    }, speed);
  };

  useEffect(() => {
    decrypt();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text]);

  return (
    <span 
      className={`decrypted-text ${className}`}
      style={{
        fontFamily: 'monospace',
        display: 'inline-block'
      }}
    >
      {displayText || text}
    </span>
  );
}
