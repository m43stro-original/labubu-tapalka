"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface FloatingItem {
  id: number;
  x: number;
  y: number;
  text: string;
  isCrit?: boolean;
}

interface FloatingNumbersProps {
  items: FloatingItem[];
  onRemove: (id: number) => void;
}

export const FloatingNumbers: React.FC<FloatingNumbersProps> = ({ items, onRemove }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{
              opacity: 1,
              scale: item.isCrit ? 1.4 : 1,
              x: item.x - 24,
              y: item.y - 30,
            }}
            animate={{
              opacity: 0,
              scale: item.isCrit ? 1.6 : 1.1,
              y: item.y - 120,
              x: item.x - 24 + (Math.random() * 30 - 15),
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.75,
              ease: [0.23, 1, 0.32, 1], // Emil Kowalski ease-out
            }}
            onAnimationComplete={() => onRemove(item.id)}
            className={`absolute font-black tracking-tight drop-shadow-md select-none ${
              item.isCrit
                ? "text-brand-gold text-2xl font-black drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]"
                : "text-white text-lg font-extrabold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            }`}
          >
            {item.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
