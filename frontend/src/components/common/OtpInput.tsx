import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface OtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onResend: () => void;
  isLoading: boolean;
  error?: string;
  email: string;
}

export default function OtpInput({ value, onChange, onSubmit, onResend, isLoading, error, email }: OtpInputProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first empty input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (/[^0-9]/.test(val)) return; // Only numbers
    
    // Update the specific character
    const newOtp = value.split('').concat(Array(6).fill('')).slice(0, 6);
    newOtp[index] = val.slice(-1); // Take the last character in case of fast, multi-character typing
    const newValue = newOtp.join('');
    
    onChange(newValue);

    // Auto-focus next input box
    if (val && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // Automatically focus the previous input and clear it if the current one is already empty
        const newOtp = value.split('').concat(Array(6).fill('')).slice(0, 6);
        newOtp[index - 1] = '';
        onChange(newOtp.join(''));
        inputRefs.current[index - 1]?.focus();
      } else if (value[index]) {
        // Clear the current input
        const newOtp = value.split('').concat(Array(6).fill('')).slice(0, 6);
        newOtp[index] = '';
        onChange(newOtp.join(''));
      }
    } else if (e.key === 'Enter') {
      if (value.length === 6) {
        onSubmit();
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted) {
      // Create padded base
      const newOtp = pasted.split('').concat(Array(6 - pasted.length).fill('')).join('');
      onChange(newOtp);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleResendClick = () => {
    setTimeLeft(60);
    onResend();
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold text-white">{t('otp.title')}</h1>
        <p className="text-sm text-white/60 mt-2">{t('otp.subtitle')} <span className="font-medium text-emerald-300">{email}</span></p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur-md">
        <div className="flex justify-center gap-2 sm:gap-3 mb-6">
          {Array(6).fill(0).map((_, i) => (
            <motion.input
              key={i}
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.1 }}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value[i] || ''}
              onChange={(e) => handleChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onFocus={handleFocus}
              onPaste={handlePaste}
              className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border bg-white/5 text-center text-xl sm:text-2xl font-bold font-mono text-white outline-none transition-all shadow-inner
                ${value[i] ? 'border-emerald-400/50 shadow-emerald-400/10 bg-emerald-400/10' : 'border-white/10 focus:border-emerald-400 focus:bg-white/10'}
              `}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginTop: 0 }} 
              animate={{ opacity: 1, height: 'auto', marginTop: -8, marginBottom: 16 }} 
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-red-300 text-center bg-red-500/10 border border-red-500/20 py-2 rounded-lg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: value.length === 6 ? 1.02 : 1 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => onSubmit(e)}
          disabled={isLoading || value.length !== 6}
          className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
              {t('otp.verifying')}
            </div>
          ) : (
            t('otp.verify_btn')
          )}
        </motion.button>

        <div className="mt-5 text-center text-sm text-white/50">
          {t('otp.no_code')}{' '}
          {timeLeft > 0 ? (
            <span className="text-white/30 font-mono tracking-widest pl-1">00:{timeLeft.toString().padStart(2, '0')}</span>
          ) : (
            <button 
              onClick={handleResendClick} 
              className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline transition-colors focus:outline-none"
            >
              {t('otp.resend')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
