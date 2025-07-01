# 🧪 Prompt Engineering Manual for RumiAI Claude Flows

This document defines the **universal methodology** for writing all Claude prompt flows used in RumiAI's TikTok video analysis pipeline, based on the creative_density.txt implementation.

---

## 🔧 Core Prompt Engineering Principles

### 1. **Descriptive, Not Prescriptive**
- Extract observable facts, not judgments
- No qualitative terms like "effective," "strong," or "risk"
- Focus on ML-ready data extraction

### 2. **6-Block Modular Output Structure**
Each prompt outputs exactly 6 domain-prefixed blocks:
- `[domain]CoreMetrics`
- `[domain]Dynamics`
- `[domain]Interactions`
- `[domain]KeyEvents`
- `[domain]Patterns`
- `[domain]Quality`

### 3. **Complete Removal of Analysis Instructions**
- NO "Part 1", "Part 2" analysis sections
- NO optimization insights
- NO risk assessments
- Just data extraction into structured blocks

---

## 📋 Prompt Structure Template

Each prompt must follow this exact structure:

### 1. **Goal Statement**
```
Goal: Extract [domain] features as structured data for ML analysis
```

### 2. **Input Specification**
```
Input File: unified_analysis/[video_id].json

You will receive precomputed [domain] metrics:
- `metric_name`: Description
- `metric_name`: Description
[List all precomputed metrics with exact names]

Raw Timeline Data (for validation):
- `timeline_name`: Description
[List relevant timelines]
```

### 3. **Output Block Definitions**
```
Output the following 6 modular blocks:

1. [domain]CoreMetrics
{
  "metricName": type,
  "metricName": type,
  "confidence": float
}

[Continue for all 6 blocks with exact JSON structure]
```

### 4. **Constraints Section**
```
Constraints:
- Output ONLY the 6 JSON blocks, no additional text
- All timestamps must align with input data
- Include confidence scores based on data quality
- Report absences explicitly (empty arrays, false flags)
- Use descriptive values, not prescriptive judgments
- [Add domain-specific classification rules with thresholds]
```

---

## 🔄 Conversion Process from Old Prompts

### Step 1: Remove All Analysis Sections
Delete everything like:
- "Part 1: Creative Density Classification"
- "Part 2: Enhanced Peak Analysis"
- Analysis instructions
- Strategic insights
- Risk assessments

### Step 2: Define Domain-Specific Metrics
List the actual precomputed metrics you receive:
```
You will receive precomputed creative density metrics:
- `average_density`: Mean creative elements per second
- `max_density`: Maximum elements in any second
```

### Step 3: Map Metrics to 6 Blocks

| Block | What Goes Here |
|-------|----------------|
| **CoreMetrics** | Raw measurements, counts, averages, totals |
| **Dynamics** | Changes over time, curves, progressions, volatility |
| **Interactions** | Cross-modal relationships, synchronization |
| **KeyEvents** | Timestamped peaks, transitions, significant moments |
| **Patterns** | Boolean flags, classifications, ML tags |
| **Quality** | Confidence scores, data completeness, reliability |

### Step 4: Add Classification Rules to Constraints
Include specific thresholds for classifications:
```
- Classify density based on elements_per_second: <0.5 = minimal, 0.5-1.5 = medium, >1.5 = heavy
- Classify cognitive load based on max_density and volatility combinations
- Identify dead zones from density_curve where density = 0
```

---

## 🎯 Block Naming Convention

Always prefix blocks with the domain:
- `densityCoreMetrics` (not just `CoreMetrics`)
- `speechDynamics` (not just `Dynamics`)  
- `pacingPatterns` (not just `Patterns`)

---

## ✅ Implementation Checklist

- [ ] Goal states "Extract [domain] features as structured data for ML analysis"
- [ ] Listed all precomputed metrics with exact variable names
- [ ] Removed ALL analysis/insight sections
- [ ] Defined exactly 6 blocks with domain prefix
- [ ] Each block includes `confidence: float`
- [ ] Added constraints section with classification rules
- [ ] No prescriptive language anywhere
- [ ] Output format is pure JSON blocks

---

## 📊 Example: Creative Density Implementation

```
Goal: Extract creative density features as structured data for ML analysis

Input File: unified_analysis/[video_id].json

You will receive precomputed creative density metrics:
- `average_density`: Mean creative elements per second
[... full list ...]

Output the following 6 modular blocks:

1. densityCoreMetrics
{
  "avgDensity": float,
  "maxDensity": float,
  [... full structure ...]
}

[... blocks 2-6 ...]

Constraints:
- Output ONLY the 6 JSON blocks, no additional text
- Classify density based on elements_per_second: <0.5 = minimal, 0.5-1.5 = medium, >1.5 = heavy
[... full constraints ...]
```

---

This manual ensures all prompts output consistent, ML-ready data structures without human-readable insights or judgments.