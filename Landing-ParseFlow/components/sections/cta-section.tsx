"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { BrutalButton } from "../brutal-button"
import { SectionWrapper } from "../section-wrapper"

export function CTASection() {
  return (
    <SectionWrapper className="bg-primary">
      <motion.div 
        className="text-center max-w-3xl mx-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-primary-foreground mb-6 text-balance">
          Stop reading statements.
          <br />
          <span className="bg-foreground text-background px-3 inline-block mt-2 -rotate-1">
            Start understanding them.
          </span>
        </h2>
        <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
          Join thousands of businesses already saving hours every week with ParseFlow.
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
            Upload Your Statement
            <ArrowRight className="w-5 h-5 ml-2 inline-block" />
          </BrutalButton>
        </motion.div>
      </motion.div>
    </SectionWrapper>
  )
}
