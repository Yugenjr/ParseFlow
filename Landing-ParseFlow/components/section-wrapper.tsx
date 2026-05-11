"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SectionWrapperProps {
  children: React.ReactNode
  className?: string
  id?: string
  contentClassName?: string
}

export function SectionWrapper({ children, className, id, contentClassName }: SectionWrapperProps) {
  return (
    <motion.section
      id={id}
      className={cn("py-16 md:py-24 px-4 md:px-8", className)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className={cn("relative z-10 mx-auto w-full max-w-7xl", contentClassName)}>
        {children}
      </div>
    </motion.section>
  )
}
