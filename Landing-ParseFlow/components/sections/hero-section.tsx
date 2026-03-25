"use client"

import { motion } from "framer-motion"
import { Upload, FileText, Sparkles } from "lucide-react"
import { BrutalButton } from "../brutal-button"
import { SectionWrapper } from "../section-wrapper"

export function HeroSection() {
  return (
    <SectionWrapper className="pt-28 md:pt-36 min-h-screen flex items-center">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-balance">
            Turn Bank Statements into{" "}
            <span className="bg-primary px-2 inline-block -rotate-1">Smart Insights</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-lg">
            Upload any bank statement. Get structured, actionable data in seconds. 
            No more manual entry. No more errors.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <BrutalButton size="lg">Try It Now</BrutalButton>
            <BrutalButton variant="outline" size="lg">See How It Works</BrutalButton>
          </div>
          <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Free tier available
            </span>
          </div>
        </motion.div>

        {/* Right Content - Mock Dashboard */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="bg-card border-3 border-foreground p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            {/* Upload Area */}
            <motion.div 
              className="border-3 border-dashed border-foreground p-8 text-center mb-6 cursor-pointer"
              whileHover={{ borderColor: "var(--primary)", backgroundColor: "rgba(255,214,0,0.1)" }}
              transition={{ duration: 0.2 }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-bold">Drop your statement here</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, CSV, or image files</p>
            </motion.div>

            {/* Processing Preview */}
            <div className="space-y-3">
              <motion.div 
                className="flex items-center gap-3 p-3 bg-muted border-3 border-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <FileText className="w-5 h-5" />
                <span className="flex-1 font-medium">bank_statement_march.pdf</span>
                <span className="text-sm text-green-600 font-bold">Processed</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3 p-3 bg-primary/20 border-3 border-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="flex-1 font-medium">142 transactions extracted</span>
                <span className="text-sm font-bold">View →</span>
              </motion.div>
            </div>
          </div>

          {/* Decorative Element */}
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary border-3 border-foreground -z-10" />
        </motion.div>
      </div>
    </SectionWrapper>
  )
}
