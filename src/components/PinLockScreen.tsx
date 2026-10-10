import { useState } from 'react';
import { Shield, Lock, X } from 'lucide-react';

interface PinLockScreenProps {
  expectedPin: string;
  onUnlock: () => void;
  onBack: () => void;
}

export function PinLockScreen({ expectedPin, onUnlock, onBack }: PinLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === expectedPin) {
          onUnlock();
        } else {
          setError(true);
          setPin('');
        }
      }, 200);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center px-6">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 p-2 text-white/40 hover:text-white/80 transition"
      >
        <X size={22} />
      </button>

      <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 shadow-xl">
        <Shield size={36} className="text-white/80" />
      </div>

      <h1 className="text-xl font-bold text-white mb-1">Espace Pro</h1>
      <p className="text-sm text-blue-200 mb-8">Entrez le code direction pour accéder</p>

      {/* PIN dots */}
      <div className={'flex gap-3 mb-2 ' + (error ? 'animate-[shake_0.3s_ease]' : '')}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              error
                ? 'bg-rose-500'
                : i < pin.length
                ? 'bg-white scale-110'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-rose-400 font-semibold mt-2 mb-4">Code incorrect</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 mt-6 max-w-xs w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => handleDigit(d)}
            className="aspect-square flex items-center justify-center text-2xl font-bold text-white bg-white/10 backdrop-blur-sm rounded-2xl active:scale-90 active:bg-white/20 transition"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => handleDigit('0')}
          className="aspect-square flex items-center justify-center text-2xl font-bold text-white bg-white/10 backdrop-blur-sm rounded-2xl active:scale-90 active:bg-white/20 transition"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="aspect-square flex items-center justify-center text-white/60 bg-white/5 rounded-2xl active:scale-90 transition"
        >
          <Lock size={20} />
        </button>
      </div>
    </div>
  );
}
