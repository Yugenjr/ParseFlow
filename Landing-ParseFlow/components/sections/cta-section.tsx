"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { BrutalButton } from "../brutal-button"
import { SectionWrapper } from "../section-wrapper"

export function CTASection() {
  return (
    <SectionWrapper id="cta" className="bg-primary" contentClassName="bg-background text-foreground border-3 border-foreground shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 md:p-10">
      <motion.div 
        className="text-center max-w-3xl mx-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-primary-foreground mb-6 text-balance">
          Stop sorting documents manually.
          <br />
          <span className="bg-foreground text-background px-3 inline-block mt-2 -rotate-1">
            Let AI do it instantly.
          </span>
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
          Automate document routing and compliance with a single upload.
        </p>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <BrutalButton 
            variant="outline" 
            size="lg" 
            className="bg-foreground text-background hover:bg-background hover:text-foreground border-foreground"
          >
            Upload Document
            <ArrowRight className="w-5 h-5 ml-2 inline-block" />
          </BrutalButton>
        </motion.div>
      </motion.div>
    </SectionWrapper>
  )
}
