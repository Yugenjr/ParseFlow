'use client';

import { ArrowRight, BarChart3, TrendingUp, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { fetchUserDocuments, fetchDashboardStats, BackendDocument, BackendStats } from "../lib/backend-api";

const pipelineSteps = [
  { label: 'UPLOAD', time: '120ms' },
  { label: 'OCR', time: '450ms' },
  { label: 'PRE-PROCESS', time: '80ms' },
  { label: 'CLASSIFY', time: '340ms' },
  { label: 'EXTRACT', time: '257ms' },
];

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#14B8A6'];

function shouldIncludeInAccuracy(doc: BackendDocument): boolean {
  const method = String(doc.method || '').toLowerCase();
  const docType = String(doc.document_type || '').toLowerCase();
  const unknownType = !docType || docType.includes('unknown');
  const storageOnly = method.includes('manual upload') || method.includes('storage sync');
  const visionOrFallback = method.includes('vision') || method.includes('fallback');
  if (storageOnly) return false;
  return !(unknownType && visionOrFallback);
}

export default function TransparencyPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [stats, setStats] = useState<BackendStats>({ avgProcessingTimeSec: 0, queryCount: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const [docs, dashboardStats] = await Promise.all([
          fetchUserDocuments(token),
          fetchDashboardStats(token)
        ]);

        setDocuments(docs);
        setStats(dashboardStats);
      } catch (err) {
        console.error('Failed to load transparency data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [getToken]);

  // Calculate statistics
  const categoryData = documents.reduce((acc: Record<string, number>, doc) => {
    const cat = doc.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const methodData = documents.reduce((acc: Record<string, number>, doc) => {
    const method = doc.method || 'Unknown';
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  const aiMetricDocs = documents.filter(shouldIncludeInAccuracy);

  const confidenceRanges = [
    { range: '80-85%', count: 0 },
    { range: '85-90%', count: 0 },
    { range: '90-95%', count: 0 },
    { range: '95-98%', count: 0 },
    { range: '98-100%', count: 0 }
  ];

  aiMetricDocs.forEach(doc => {
    const conf = doc.confidence || 0;
    if (conf >= 80 && conf < 85) confidenceRanges[0].count++;
    else if (conf >= 85 && conf < 90) confidenceRanges[1].count++;
    else if (conf >= 90 && conf < 95) confidenceRanges[2].count++;
    else if (conf >= 95 && conf < 98) confidenceRanges[3].count++;
    else if (conf >= 98) confidenceRanges[4].count++;
  });

  const timelineData = aiMetricDocs
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-30)
    .map((doc, idx) => ({
      time: new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      accuracy: doc.accuracy || doc.confidence || 0,
      confidence: doc.confidence || 0,
      processingTime: (doc.metadata?.processing_time_ms || 0) / 1000
    }));

  const accuracyVsTime = aiMetricDocs.map(doc => ({
    x: Math.round((doc.metadata?.processing_time_ms || 0) / 10),
    y: doc.accuracy || doc.confidence || 0,
    method: doc.method
  })).slice(0, 100);

  const categoryPieData = Object.entries(categoryData).map(([key, value]) => ({
    name: key,
    value: value as number
  }));

  const methodPieData = Object.entries(methodData).map(([key, value]) => ({
    name: key,
    value: value as number
  }));

  const accuracyEligibleDocs = aiMetricDocs;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">TRANSPARENCY</h2>

      {/* Top Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="card-brutal">
          <p className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Total Documents</p>
          <p className="font-heading text-4xl text-primary">{documents.length}</p>
        </div>
        <div className="card-brutal">
          <p className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Avg Processing Time</p>
          <p className="font-heading text-4xl text-primary">{stats.avgProcessingTimeSec.toFixed(2)}s</p>
        </div>
        <div className="card-brutal">
          <p className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Total Queries</p>
          <p className="font-heading text-4xl text-primary">{stats.queryCount}</p>
        </div>
        <div className="card-brutal">
          <p className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Avg Accuracy</p>
          <p className="font-heading text-4xl text-primary">
            {accuracyEligibleDocs.length > 0 
              ? Math.round(accuracyEligibleDocs.reduce((sum, doc) => sum + (doc.accuracy ?? doc.confidence ?? 0), 0) / accuracyEligibleDocs.length)
              : 0}%
          </p>
        </div>
      </div>

      {/* Pipeline Flowchart */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">PIPELINE FLOWCHART</h3>
        <div className="card-brutal overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="bg-secondary border border-border rounded-sm px-4 py-3 text-center">
                  <p className="font-heading text-lg text-foreground tracking-wider">{step.label}</p>
                  <p className="font-mono text-[10px] text-primary">{step.time}</p>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-primary shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 font-mono text-xs text-muted-foreground">
            TOTAL: {pipelineSteps.reduce((s, p) => s + parseInt(p.time), 0)}ms | HIGHLIGHTED PATH: OCR → LLM CLASSIFICATION
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Category Distribution */}
        <div>
          <h3 className="font-heading text-lg text-foreground tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> CATEGORY DISTRIBUTION
          </h3>
          <div className="card-brutal p-4">
            {categoryPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {categoryPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </div>
        </div>

        {/* 2. Processing Method Breakdown */}
        <div>
          <h3 className="font-heading text-lg text-foreground tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> PROCESSING METHOD
          </h3>
          <div className="card-brutal p-4">
            {methodPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={methodPieData}
                    cx="50%"
                    cy="50%"
                    paddingAngle={5}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {methodPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </div>
        </div>

        {/* 3. Confidence Distribution */}
        <div>
          <h3 className="font-heading text-lg text-foreground tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> CONFIDENCE DISTRIBUTION
          </h3>
          <div className="card-brutal p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceRanges}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Accuracy vs Processing Time */}
        <div>
          <h3 className="font-heading text-lg text-foreground tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> ACCURACY VS PROCESSING TIME
          </h3>
          <div className="card-brutal p-4">
            {accuracyVsTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="x" type="number" label={{ value: 'Processing Time (ms)', position: 'insideBottomRight', offset: -10 }} />
                  <YAxis dataKey="y" type="number" label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="ML" data={accuracyVsTime.filter(d => d.method === 'ML')} fill="#3B82F6" />
                  <Scatter name="Vision LLM" data={accuracyVsTime.filter(d => d.method === 'Vision LLM')} fill="#8B5CF6" />
                  <Scatter name="Storage Sync" data={accuracyVsTime.filter(d => d.method === 'Storage Sync')} fill="#F59E0B" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </div>
        </div>

        {/* 5. Processing Timeline */}
        <div>
          <h3 className="font-heading text-lg text-foreground tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> DOCUMENT TIMELINE
          </h3>
          <div className="card-brutal p-4">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="time" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="confidence" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </div>
        </div>

        {/* 6. Method Performance Radar */}
        <div>
          <h3 className="font-heading text-lg text-foreground tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> METHOD PERFORMANCE
          </h3>
          <div className="card-brutal p-4">
            {methodPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={methodPieData}>
                  <PolarGrid stroke="#ccc" />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis />
                  <Radar name="Count" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">AI REASONING</h3>
        <div className="card-brutal">
          <p className="font-body text-sm text-foreground leading-relaxed">
            The document classification system implements a multi-strategy approach optimized for security and accuracy:
          </p>
          <ul className="mt-3 space-y-2 font-body text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">01.</span> <strong>Identity Documents:</strong> ML model processes with 97% confidence threshold for enhanced security and fraud detection
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">02.</span> <strong>Other Documents:</strong> Advanced Vision LLM handles classification with OCR + semantic understanding for diverse document types
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">03.</span> <strong>Low Confidence Cases:</strong> EasyOCR + text analysis fallback extracts data with linguistic pattern matching when primary methods score below threshold
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">04.</span> <strong>Unclear Images:</strong> Advanced image analysis detects and processes documents with poor quality, rotations, or obstructions
            </li>
          </ul>
        </div>
      </div>

      {/* Model Details */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">MODEL DETAILS</h3>
        <div className="card-brutal p-0 divide-y divide-border font-mono text-xs">
          {[
            { key: 'IDENTITY DOCUMENTS', value: 'ML Model (Security-First)' },
            { key: 'OTHER DOCUMENTS', value: 'Advanced Vision LLM (Classification)' },
            { key: 'FALLBACK METHOD', value: 'EasyOCR + Text Analysis' },
            { key: 'UNCLEAR IMAGES', value: 'Advanced Image Analysis' },
            { key: 'ML THRESHOLD', value: '97% Confidence' },
            { key: 'API VERSION', value: 'v2.1.0' },
          ].map((item, i) => (
            <div key={item.key} className={`flex justify-between px-5 py-3 ${i % 2 === 0 ? 'bg-secondary/30' : ''}`}>
              <span className="text-muted-foreground">{item.key}</span>
              <span className="text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
