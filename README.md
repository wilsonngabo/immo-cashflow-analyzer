# 🏙️ Rendement Immo

**Rendement Immo** est une application web de simulation et d'analyse d'investissements immobiliers locatifs en France.

Conçue pour les investisseurs exigeants, elle permet de calculer la rentabilité précise d'un projet en tenant compte de la fiscalité (LMNP, SCI), des aides (PTZ, Action Logement), et de comparer différents scénarios.

![Rendement Immo](https://via.placeholder.com/800x400?text=Rendement+Immo)

---

## ✨ Fonctionnalités Clés

### 1. 🧮 Calculateur Financier Avancé
- **Fiscalité Intégrée** : Comparaison automatique LMNP (Micro/Réel), Foncier (Micro/Réel), et SCI à l'IS.
- **Prêts complexes** : Prise en charge des prêts aidés (PTZ lissé, Action Logement) avec conditions de zones (A, B1, B2, C).
- **KPIs en Temps Réel** : Cashflow (Brut/Net/Net-Net), Rendement, TRI, Taux d'endettement.

### 2. 🌍 Analyse de Marché Locale
- **Intégration Gouv.fr** : Recherche automatique par commune.
- **Smart Data** : Estimation automatique des prix/m² et loyers (simulés) selon la ville choisie.

### 3. 🔥 Gestion des Charges & Énergie
- **Estimation Énergétique** : Calcul automatique du coût Élec/Gaz selon la surface et le type de chauffage (Individuel/Collectif).
- **Récapitulatif Détaillé** : Vue claire des sorties mensuelles (Crédit, Taxe Foncière, Charges, Internet, PNO).

### 4. ⚖️ Comparateur Intelligent (V2)
- **Tableau de Bord** : Comparez plusieurs simulations côte à côte.
- **Badges de Verdict** : Le système analyse vos projets et attribue des badges :
    - 🏆 *Cashflow King*
    - 🚀 *Top Rentabilité*
    - ✅ *Autofinancé*
- **Persistance** : Vos simulations sont sauvegardées automatiquement (LocalStorage).

### 5. 📄 Dossier Bancaire PDF
- Exportez un **Dossier de Présentation** propre et professionnel pour votre banquier.
- Inclus : Synthèse du projet, Plan de financement, Détail des charges.

---

## 🛠️ Stack Technique

- **Framework** : [Next.js 14](https://nextjs.org/) (App Router)
- **Langage** : [TypeScript](https://www.typescriptlang.org/)
- **Styling** : [Tailwind CSS](https://tailwindcss.com/) + [Shadcn/ui](https://ui.shadcn.com/)
- **Icônes** : [Lucide React](https://lucide.dev/)
- **Graphiques** : [Recharts](https://recharts.org/)

---

## 🚀 Installation & Démarrage

1. Cloner le projet :
   ```bash
   git clone https://github.com/wilsonngabo/immo-cashflow-analyzer.git
   cd immo-cashflow-analyzer
   ```

2. Installer les dépendances (pnpm recommandé) :
   ```bash
   pnpm install
   # ou
   npm install
   ```

3. Lancer le serveur de développement :
   ```bash
   pnpm dev
   ```

4. Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## 📝 Auteur

Développé dans le cadre d'un projet d'analyse financière immobilière.
**Version :** 0.1.0 (Beta)
