"use client"

import { motion } from "framer-motion"
import { ArrowDown, BadgeCheck, FileText, Sparkles, Upload } from "lucide-react"
import { BrutalButton } from "../brutal-button"
import { SectionWrapper } from "../section-wrapper"

export function HeroSection() {
  return (
    <SectionWrapper className="pt-28 md:pt-36 min-h-screen flex items-center relative overflow-hidden">
      <motion.div
        aria-hidden
        className="absolute -top-10 right-4 h-36 w-36 rounded-full border-3 border-foreground/80 bg-primary/25 blur-[1px]"
        animate={{ y: [0, 16, 0], x: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-6 -left-10 h-24 w-24 rounded-none border-3 border-foreground bg-secondary/25"
        animate={{ y: [0, -14, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <motion.span
            className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 border-3 border-foreground font-bold text-sm mb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <BadgeCheck className="h-4 w-4 text-primary" />
            AI document parsing for modern teams
          </motion.span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-balance">
            Instantly Classify Documents with AI
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-lg">
            Upload any document and let ParseFlow identify its type in seconds with high accuracy.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <BrutalButton size="lg" href="#cta">Try Classification</BrutalButton>
            <BrutalButton variant="outline" size="lg" href="#solution">See How It Works</BrutalButton>
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

          <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-xl">
            {[
              ["92%", "confidence"],
              ["< 1 sec", "classification"],
              ["3 services", "single workflow"],
            ].map(([value, label]) => (
              <motion.div
                key={label}
                className="bg-card border-3 border-foreground px-4 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                whileHover={{ y: -3 }}
              >
                <div className="text-2xl font-black leading-none">{value}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-2">{label}</div>
              </motion.div>
            ))}
          </div>

          <motion.a
            href="#problem"
            className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em]"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown className="h-4 w-4" />
            scroll to see the flow
          </motion.a>
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
              className="border-3 border-dashed border-foreground p-8 text-center mb-6 cursor-pointer bg-background/70 backdrop-blur-sm"
              whileHover={{ borderColor: "var(--primary)", backgroundColor: "rgba(255,214,0,0.12)", y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-bold">Drop your document here</p>
              <p className="text-sm text-muted-foreground mt-1">PDF or image files</p>
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
                <span className="flex-1 font-medium">invoice_april.pdf</span>
                <span className="text-sm text-green-600 font-bold">Processed</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-3 p-3 bg-primary/20 border-3 border-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="flex-1 font-medium">AI predicts: Invoice — 92% confidence</span>
                <span className="text-sm font-bold">View →</span>
              </motion.div>
            </div>
          </div>

          {/* Decorative Element */}
          <motion.div
            aria-hidden
            className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary border-3 border-foreground -z-10"
            animate={{ rotate: [0, 6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </SectionWrapper>
  )
}
