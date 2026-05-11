"use client"

import { motion } from "framer-motion"
import { Upload, Cpu, Table2, BarChart3 } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload document (PDF/Image)",
    description: "Submit a PDF or image of the document to classify.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Extract text using document processing",
    description: "OCR and document parsing extract the raw text.",
  },
  {
    icon: Table2,
    step: "03",
    title: "AI analyzes content and patterns",
    description: "Machine learning inspects structure and language to find patterns.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "System predicts document category",
    description: "The model assigns the most likely document type.",
  },
  {
    icon: BarChart3,
    step: "05",
    title: "Results displayed with confidence score",
    description: "See the predicted type alongside a confidence percentage.",
  },
]

export function SolutionSection() {
  return (
    <SectionWrapper id="solution" contentClassName="bg-card border-3 border-foreground shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 md:p-10">
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
          Five Steps to Document Classification
        </h2>
      </div>

        <div className="relative">
        {/* Timeline Line - Desktop */}
        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-foreground -translate-y-1/2" />

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* First row: first three steps */}
          {steps.slice(0, 3).map((step, index) => (
            <motion.div
              key={step.step}
              className="relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
            >
              <motion.div 
                className="w-16 h-16 bg-primary border-3 border-foreground flex items-center justify-center mx-auto mb-6 relative z-10"
                whileHover={{ rotate: 5, scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <span className="font-black text-xl">{step.step}</span>
              </motion.div>

              <div className="text-center">
                <step.icon className="w-8 h-8 mx-auto mb-3" strokeWidth={2.5} />
                <h3 className="text-lg font-black mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>

              {index < steps.slice(0, 3).length - 1 && (
                <div className="md:hidden w-1 h-8 bg-foreground mx-auto mt-6" />
              )}
            </motion.div>
          ))}

          {/* Second row: last two steps centered */}
          <div className="md:col-span-3">
            <div className="grid grid-cols-2 gap-8 justify-center">
              {steps.slice(3).map((step, i) => (
                <motion.div
                  key={step.step}
                  className="relative"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (3 + i) * 0.15, duration: 0.5 }}
                >
                  <motion.div 
                    className="w-16 h-16 bg-primary border-3 border-foreground flex items-center justify-center mx-auto mb-6 relative z-10"
                    whileHover={{ rotate: 5, scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="font-black text-xl">{step.step}</span>
                  </motion.div>

                  <div className="text-center">
                    <step.icon className="w-8 h-8 mx-auto mb-3" strokeWidth={2.5} />
                    <h3 className="text-lg font-black mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  )
}
