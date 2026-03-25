"use client"

import { motion } from "framer-motion"
import { Upload, Cpu, Table2, BarChart3 } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload File",
    description: "Drop your bank statement in any format - PDF, CSV, or image.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "AI Extracts Data",
    description: "Our AI reads and understands every transaction automatically.",
  },
  {
    icon: Table2,
    step: "03",
    title: "Structured Output",
    description: "Get clean, organized data ready for export or integration.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Insights Generated",
    description: "Instant analytics and spending patterns at your fingertips.",
  },
]

export function SolutionSection() {
  return (
    <SectionWrapper id="solution">
      <div className="text-center mb-16">
        <motion.span 
          className="inline-block bg-secondary text-secondary-foreground px-4 py-1 font-bold text-sm mb-4 border-3 border-foreground"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          HOW IT WORKS
        </motion.span>
        <h2 className="text-3xl md:text-4xl font-black text-balance">
          Four Steps to Financial Clarity
        </h2>
      </div>

      <div className="relative">
        {/* Timeline Line - Desktop */}
        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-foreground -translate-y-1/2" />

        <div className="grid md:grid-cols-4 gap-8 relative">
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              className="relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
            >
              {/* Step Number */}
              <motion.div 
                className="w-16 h-16 bg-primary border-3 border-foreground flex items-center justify-center mx-auto mb-6 relative z-10"
                whileHover={{ rotate: 5, scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <span className="font-black text-xl">{step.step}</span>
              </motion.div>

              {/* Content */}
              <div className="text-center">
                <step.icon className="w-8 h-8 mx-auto mb-3" strokeWidth={2.5} />
                <h3 className="text-lg font-black mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>

              {/* Connector Arrow - Mobile */}
              {index < steps.length - 1 && (
                <div className="md:hidden w-1 h-8 bg-foreground mx-auto mt-6" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  )
}
