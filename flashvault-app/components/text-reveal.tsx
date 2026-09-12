"use client";
import { motion } from "framer-motion";

export function TextReveal({ children, delay = 0 }: { children: string; delay?: number }) {
  const words = children.split(" ");
  return (
    <span className="inline-flex flex-wrap">
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ y: "110%", opacity: 0 }}
          whileInView={{ y: "0%", opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: delay + i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block overflow-hidden mr-[0.25em]"
        >
          <span className="inline-block">{w}</span>
        </motion.span>
      ))}
    </span>
  );
}

export function LineReveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        initial={{ y: "100%" }}
        whileInView={{ y: "0%" }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
