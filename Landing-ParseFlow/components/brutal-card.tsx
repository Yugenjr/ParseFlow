"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface BrutalCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function BrutalCard({ children, className, hover = true }: BrutalCardProps) {
  return (
    <motion.div
      className={cn(
        "bg-card border-3 border-foreground p-6",
        className
      )}
      whileHover={hover ? { 
        scale: 1.02, 
        boxShadow: "8px 8px 0px 0px rgba(0,0,0,1)" 
      } : undefined}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}
