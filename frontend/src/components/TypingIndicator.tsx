import React from 'react'
import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'

const TypingIndicator: React.FC = () => {
  return (
    <motion.div
      className="flex justify-start items-end gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Avatar */}
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-md">
        <Leaf className="w-3 h-3 text-white" />
      </div>

      {/* Bubble */}
      <div className="relative bg-white/25 backdrop-blur-md px-4 py-3 rounded-2xl rounded-bl-sm border border-white/30 shadow-lg">
        {/* Subtle inner glow */}
        <div className="absolute inset-0 rounded-2xl rounded-bl-sm bg-gradient-to-br from-green-400/10 to-teal-500/10 pointer-events-none" />

        <div className="flex items-center gap-1.5">
          {[0, 0.18, 0.36].map((delay, i) => (
            <motion.span
              key={i}
              className="block w-2 h-2 rounded-full bg-gradient-to-b from-green-400 to-teal-500"
              animate={{
                y: [0, -6, 0],
                scale: [1, 1.2, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 0.7,
                repeat: Infinity,
                delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default TypingIndicator