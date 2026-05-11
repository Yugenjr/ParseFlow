"use client"

import { motion } from "framer-motion"
import { Clock, AlertTriangle, FileQuestion } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"
import { BrutalCard } from "../brutal-card"

const problems = [
  {
    icon: Clock,
    title: "Manual document sorting is slow and inefficient",
    description: "Teams waste time moving files between people and systems.",
  },
  {
    icon: AlertTriangle,
    title: "High risk of human error in classification",
    description: "Inconsistent tags and mistakes create rework and compliance risk.",
  },
  {
    icon: FileQuestion,
    title: "Delays in compliance and processing workflows",
    description: "Slow classification slows downstream processes and approvals.",
  },
  {
    icon: FileQuestion,
    title: "Difficulty handling large volumes of documents",
    description: "Scaling manual processes becomes costly and fragile.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function ProblemSection() {
  return (
    <SectionWrapper
      id="problem"
      className="bg-foreground text-background"
      contentClassName="bg-background text-foreground border-3 border-foreground shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 md:p-10"
    >
      <div className="text-center mb-12">
        <motion.span 
          className="inline-block bg-primary text-primary-foreground px-4 py-1 font-bold text-sm mb-4 border-3 border-background"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          THE PROBLEM
        </motion.span>
        <h2 className="text-3xl md:text-4xl font-black text-balance">
          Manual Document Sorting Slows Teams Down
        </h2>
      </div>

      <motion.div 
        className="grid md:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {problems.map((problem) => (
          <motion.div key={problem.title} variants={itemVariants}>
            <BrutalCard className="h-full bg-background text-foreground">
              <problem.icon className="w-10 h-10 mb-4 text-destructive" strokeWidth={2.5} />
              <h3 className="text-xl font-black mb-2">{problem.title}</h3>
              <p className="text-muted-foreground">{problem.description}</p>
            </BrutalCard>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  )
}
