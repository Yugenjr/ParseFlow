"use client"

import { motion, useScroll, useSpring } from "framer-motion"

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  return (
    <div className="fixed left-0 top-0 z-[60] h-1 w-full bg-foreground/10">
      <motion.div
        className="h-full origin-left bg-primary shadow-[0_0_20px_rgba(0,0,0,0.35)]"
        style={{ scaleX }}
      />
    </div>
  )
}