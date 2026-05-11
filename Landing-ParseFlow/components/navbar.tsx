"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { BrutalButton } from "./brutal-button"

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "How It Works", href: "#solution" },
  { name: "Use Cases", href: "#users" },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-background border-b-3 border-foreground"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#" className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary border-3 border-foreground flex items-center justify-center">
              <span className="font-black text-sm md:text-base">PF</span>
            </div>
            <span className="font-black text-lg md:text-xl">ParseFlow</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <motion.a
                key={link.name}
                href={link.href}
                className="font-bold text-foreground hover:text-primary transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
              >
                {link.name}
              </motion.a>
            ))}
            <BrutalButton size="sm" href="#cta">Try It Now</BrutalButton>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 border-3 border-foreground"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="md:hidden bg-background border-b-3 border-foreground"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 py-4 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="font-bold text-foreground py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </a>
              ))}
              <BrutalButton size="sm" href="#cta" className="w-full">Try It Now</BrutalButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
