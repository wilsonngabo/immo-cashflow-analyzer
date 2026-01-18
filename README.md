# 🏙️ ImmoCashFlow - French Real Estate Analyzer

**ImmoCashFlow** is a modern, premium web application designed to help real estate investors calculate the profitability of their projects in France instantly.

Built with **Next.js 16**, **Tailwind CSS**, and **Framer Motion**, it offers a refined user experience with smart financial modeling.

![ImmoCashFlow Dashboard](public/window.svg)

## ✨ Key Features (V1)

### 📊 Smart Financial Calculator
- **Complete Modeling**: Inputs for Price, Works, Furniture, Rent, Charges, and Taxes.
- **Auto-Financing**: 
  - Automatically calculates **Loan Amount** based on inputs and **Personal Contribution (Apport)**.
  - Smart **Notary Fees** calculation based on property type (Ancien 8%, Neuf 2.5%, HLM 3%).
- **KPIs**: Real-time calculation of **Gross Yield**, **Net Yield**, **Cashflow**, and **Score**.

### ⚖️ Advanced Fiscal Comparison
- **Multi-Regime Analysis**: Instantly compares 4 fiscal strategies simultaneously:
  - 🏠 **LMNP Micro-BIC** (50% abatement)
  - 💼 **LMNP Réel** (Amortization & Deductions)
  - 🏢 **SCI à l'IS** (Corporate Tax)
  - 📃 **Foncier Micro** (30% abatement)
- **Best Option Highlight**: Automatically sorts and highlights the most profitable regime.

### 📍 Market Intelligence
- **Location Engine**: Integrated with `geo.api.gouv.fr` for precise city selection.
- **Market Context**: Compares your project's price per m² against the local market average.
- **Deal Rating**: Visual "Good Deal" vs "Overpriced" indicators.

### 🎨 Premium Design
- **Glassmorphism UI**: Modern aesthetic with translucent cards and blur effects.
- **Rich Visuals**: Gradient backgrounds, stacked bar charts for expense breakdown, and smooth transitions.
- **Responsive**: Fully optimized for Desktop and Mobile.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Fetching**: Native Fetch API

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm/yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/wilsonngabo/immo-cashflow-analyzer.git
   cd immo-cashflow-analyzer
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run Development Server**
   ```bash
   pnpm dev
   ```

4. **Open Application**
   Visit [http://localhost:3000](http://localhost:3000)

---

## 📂 Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router Pages
│   ├── components/
│   │   ├── calculator/      # Financial Logic UI (Forms, Results, Selector)
│   │   ├── location/        # Map & Search Components
│   │   ├── ui/              # Shadcn Primitive Components
│   ├── lib/
│   │   ├── calculations/    # Core Financial Algorithms (loan, tax, notary)
│   │   └── types.ts         # TypeScript Definitions
```

## 📝 License

Private / Proprietary. Created by Ruzindana Wilson.
