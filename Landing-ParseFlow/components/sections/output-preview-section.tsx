"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useEffect, useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"
import { SectionWrapper } from "../section-wrapper"

const transactions = [
  { date: "1 sec", description: "passport_scan.jpg", category: "Passport", amount: 92 },
  { date: "1.2 sec", description: "invoice_march.pdf", category: "Invoice", amount: 88 },
  { date: "0.9 sec", description: "pan_card.png", category: "PAN Card", amount: 95 },
]

const insights = [
  { label: "Total Income", value: 4750, change: "+12%" },
  { label: "Total Expenses", value: 1248, change: "-8%" },
  { label: "Top Category", value: "Shopping", change: "32%" },
]

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      const duration = 1000
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        setDisplayValue(Math.floor(value * progress))
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      animate()
    }
  }, [isInView, value])

  return (
    <span ref={ref}>
      {prefix}{typeof value === "number" && !isNaN(value) ? displayValue.toLocaleString() : value}{suffix}
    </span>
  )
}

export function OutputPreviewSection() {
  return (
    <SectionWrapper className="bg-foreground text-background overflow-hidden">
      <div className="text-center mb-12">
        <motion.span 
          className="inline-block bg-primary text-primary-foreground px-4 py-1 font-bold text-sm mb-4 border-3 border-background"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          OUTPUT PREVIEW
        </motion.span>
        <h2 className="text-3xl md:text-4xl font-black text-balance">
          Preview Classification Results
        </h2>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Transactions Table */}
        <motion.div 
          className="lg:col-span-3 bg-background text-foreground border-3 border-background overflow-hidden"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="bg-muted px-4 py-3 border-b-3 border-foreground">
            <h3 className="font-black">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-3 border-foreground">
                  <th className="text-left px-4 py-3 font-black text-sm">Processing</th>
                  <th className="text-left px-4 py-3 font-black text-sm">Document</th>
                  <th className="text-left px-4 py-3 font-black text-sm hidden sm:table-cell">Type</th>
                  <th className="text-right px-4 py-3 font-black text-sm">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <motion.tr
                    key={index}
                    className="border-b border-muted last:border-0"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <td className="px-4 py-3 text-sm text-muted-foreground">{tx.date}</td>
                    <td className="px-4 py-3 font-medium">{tx.description}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-bold bg-muted px-2 py-1">{tx.category}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${tx.amount >= 80 ? "text-green-600" : "text-foreground"}`}>
                      {tx.amount}%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Insights Panel */}
        <motion.div 
          className="lg:col-span-2 space-y-4"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div className="bg-background text-foreground border-3 border-background p-4">
            <p className="text-sm text-muted-foreground mb-1">Document Type</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black">Passport</span>
              <span className="text-sm text-muted-foreground">Sample</span>
            </div>
          </motion.div>

          <motion.div className="bg-background text-foreground border-3 border-background p-4">
            <p className="text-sm text-muted-foreground mb-1">Confidence Score</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black">92%</span>
              <span className="text-sm text-green-600 font-bold">High</span>
            </div>
          </motion.div>

          <motion.div className="bg-background text-foreground border-3 border-background p-4">
            <p className="text-sm text-muted-foreground mb-1">Processing Time</p>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black">1 sec</span>
              <span className="text-sm text-muted-foreground">per document</span>
            </div>
          </motion.div>

          <motion.div className="bg-background text-foreground border-3 border-background p-4">
            <p className="text-sm text-muted-foreground mb-1">Extracted Text Preview</p>
            <div className="text-sm text-muted-foreground">John Doe\nPassport No: XXXXXX\nDOB: 01/01/1980</div>
          </motion.div>
        </motion.div>
      </div>
    </SectionWrapper>
  )
}
