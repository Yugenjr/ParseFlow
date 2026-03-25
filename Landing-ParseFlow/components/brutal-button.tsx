"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface BrutalButtonProps {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "outline"
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
}

export function BrutalButton({
  children,
  variant = "primary",
  size = "md",
  className,
  onClick,
}: BrutalButtonProps) {
  const baseStyles = "font-bold border-3 border-foreground transition-all duration-200 ease-in-out"
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-foreground hover:text-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-foreground hover:text-secondary",
    outline: "bg-transparent text-foreground hover:bg-foreground hover:text-background",
  }
  
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  }

  return (
    <motion.button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      onClick={onClick}
      whileHover={{ scale: 1.03, boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      {children}
    </motion.button>
  )
}
