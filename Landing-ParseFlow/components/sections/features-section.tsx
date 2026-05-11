"use client"

import { motion } from "framer-motion"
import { Zap, Shield, Globe, FileOutput, RefreshCw, Lock } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"
import { BrutalCard } from "../brutal-card"

const features = [
  {
    icon: Zap,
    title: "Automatic document classification",
    description: "AI labels documents without manual rules or tagging.",
  },
  {
    icon: Shield,
    title: "Supports PDFs and images",
    description: "Works with scanned documents, photos, and native PDFs.",
  },
  {
    icon: Globe,
    title: "Fast AI-based prediction",
    description: "Get classification results in seconds at scale.",
  },
  {
    icon: FileOutput,
    title: "Confidence score output",
    description: "Each prediction includes a clear confidence percentage.",
  },
  {
    icon: RefreshCw,
    title: "Scalable API integration",
    description: "Integrate classification into your workflows via API.",
  },
  {
    icon: Lock,
    title: "Secure document handling",
    description: "Encrypted transfer and safe processing of sensitive files.",
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function FeaturesSection() {
  return (
    <SectionWrapper
      id="features"
      className="bg-muted"
      contentClassName="bg-card border-3 border-foreground shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] p-6 md:p-10"
    >
      <div className="text-center mb-12">
        <motion.span 
          className="inline-block bg-foreground text-background px-4 py-1 font-bold text-sm mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          FEATURES
        </motion.span>
        <h2 className="text-3xl md:text-4xl font-black text-balance">
          Built for Speed, Accuracy, and Security
        </h2>
      </div>

      <motion.div 
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
      >
        {features.map((feature) => (
          <motion.div key={feature.title} variants={itemVariants}>
            <BrutalCard className="h-full">
              <feature.icon className="w-10 h-10 mb-4 text-secondary" strokeWidth={2.5} />
              <h3 className="text-xl font-black mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </BrutalCard>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  )
}
