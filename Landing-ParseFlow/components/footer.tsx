"use client"

import { motion } from "framer-motion"

const footerLinks = {
  Product: ["Features", "Pricing", "API Docs", "Changelog"],
  Company: ["About", "Blog", "Careers", "Contact"],
  Legal: ["Privacy", "Terms", "Security"],
}

export function Footer() {
  return (
    <footer className="bg-foreground text-background border-t-3 border-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary border-3 border-background flex items-center justify-center">
                <span className="font-black text-primary-foreground">PF</span>
              </div>
              <span className="font-black text-xl">ParseFlow</span>
            </div>
            <p className="text-background/70 text-sm">
              ParseFlow – AI-powered document classification system
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-black mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <motion.a
                      href="#"
                      className="text-background/70 hover:text-primary transition-colors duration-200 text-sm"
                      whileHover={{ x: 4 }}
                    >
                      {link}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-background/50 text-sm">
            © 2026 ParseFlow. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Twitter", "LinkedIn", "GitHub"].map((social) => (
              <motion.a
                key={social}
                href={social === "GitHub" ? "https://github.com/Yugenjr/ParseFlow" : "#"}
                className="text-background/70 hover:text-primary transition-colors duration-200 text-sm font-bold"
                whileHover={{ scale: 1.05 }}
              >
                {social}
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
