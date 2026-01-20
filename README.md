# Medersub Next 📱💳

**Medersub** is a modern, full-stack **VTU (Virtual Top-Up) platform** built with **Next.js 16**, **TypeScript**, **Supabase**, and **Tailwind CSS**. It enables users to purchase airtime, data bundles, cable TV subscriptions, pay electricity bills, buy education pins, and more — all from a sleek, fast, and responsive interface.

🔗 **Live Demo**: [medersub.vercel.app](https://medersub.vercel.app)  
📦 **Repository**: https://github.com/mederhoo-script/medersub_next

---

## ✨ Features

### 🎯 VTU Services
- **📱 Airtime Purchase** – Buy airtime for all major networks instantly
- **📊 Data Bundles** – Affordable data plans for all networks (MTN, Glo, Airtel, 9mobile)
- **📺 Cable TV Subscriptions** – Renew DSTV, GOtv, Startimes subscriptions
- **💡 Electricity Bills** – Pay prepaid and postpaid electricity bills
- **🎓 Education Pins** – Purchase WAEC, NECO, JAMB, and other exam pins
- **💳 Data Pin Purchase** – Buy physical data recharge cards
- **📨 Bulk SMS** – Send bulk SMS messages
- **🌐 Internet Bundles** – Purchase specialized internet data plans

### 🔐 User Features
- **Secure Authentication** – Powered by Supabase Auth
- **Wallet System** – Fund your wallet via bank transfer or Monnify payment gateway
- **Transaction History** – Track all your purchases and payments
- **Profile Management** – Manage your account details
- **Real-time Updates** – Instant transaction confirmations

### 💻 Technical Features
- **⚡ Next.js 16 App Router** – Modern routing with server and client components
- **🔒 TypeScript** – Full type safety across the entire codebase
- **🎨 Tailwind CSS v4** – Modern, utility-first styling
- **📱 Progressive Web App (PWA)** – Install as a native-like app
- **🚀 Optimized Performance** – Fast page loads with SSR/SSG
- **♿ Accessibility** – Built with accessibility best practices
- **🎭 Framer Motion** – Smooth animations and transitions

---

## 🛠️ Tech Stack

- **[Next.js 16](https://nextjs.org/)** – React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** – Type-safe development
- **[Supabase](https://supabase.com/)** – Backend as a Service (Auth, Database, Storage)
- **[Tailwind CSS v4](https://tailwindcss.com/)** – Utility-first CSS framework
- **[Framer Motion](https://www.framer.com/motion/)** – Animation library
- **[Inlomax API](https://inlomax.com/)** – VTU service provider
- **[Monnify](https://monnify.com/)** – Payment gateway integration
- **[Lucide React](https://lucide.dev/)** – Beautiful icon library

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** installed on your machine
- **npm**, **yarn**, or **pnpm** package manager
- A **Supabase** account (free tier available)
- An **Inlomax** API key for VTU services
- A **Monnify** merchant account for payments (optional but recommended)

### 1. Clone the Repository

```bash
git clone https://github.com/mederhoo-script/medersub_next.git
cd medersub_next
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory and add your environment variables. You can use `.env.example` as a template:

```bash
cp .env.example .env.local
```

Then fill in your actual values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Inlomax VTU API
INLOMAX_API_KEY=your-inlomax-api-key

# Monnify Payment Gateway
NEXT_PUBLIC_MONNIFY_API_KEY=MK_PROD_YOUR_KEY
NEXT_PUBLIC_MONNIFY_CONTRACT_CODE=YOUR_CONTRACT_CODE
```

### 4. Set Up Supabase

1. Create a new project at [app.supabase.com](https://app.supabase.com)
2. Go to **Settings > API** and copy your project URL and keys
3. Run the database migrations:

```bash
# If you have Supabase CLI installed
supabase db push

# Or manually run the SQL from supabase/schema.sql in your Supabase SQL Editor
```

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

---

## 📦 Build for Production

```bash
npm run build
npm start
```

This creates an optimized production build and starts the production server.

---

## 📁 Project Structure

```
medersub_next/
├── app/                    # Next.js 16 App Router
│   ├── (auth)/            # Authentication pages (login, signup)
│   ├── api/               # API routes
│   ├── dashboard/         # Main application pages
│   │   ├── airtime/       # Airtime purchase
│   │   ├── data/          # Data bundle purchase
│   │   ├── cable/         # Cable TV subscription
│   │   ├── electricity/   # Electricity bill payment
│   │   ├── education/     # Education pin purchase
│   │   ├── fund/          # Wallet funding
│   │   ├── history/       # Transaction history
│   │   ├── profile/       # User profile
│   │   └── settings/      # Account settings
│   ├── admin/             # Admin panel
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # Reusable React components
│   ├── landing/          # Landing page components
│   └── ui/               # UI components
├── lib/                   # Library code and utilities
│   ├── supabase.ts       # Supabase client setup
│   ├── supabase-admin.ts # Supabase admin client
│   └── inlomax.ts        # Inlomax API integration
├── utils/                 # Utility functions
│   └── supabase/         # Supabase utilities
├── types/                 # TypeScript type definitions
├── public/                # Static assets (images, icons)
├── supabase/              # Supabase migrations and schema
├── next.config.ts         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

---

## 🔑 API Integration

### Inlomax API

This project uses the [Inlomax API](https://inlomax.com/) for all VTU operations. The integration is handled in `lib/inlomax.ts` and includes:

- Balance checking
- Service availability
- Airtime purchase
- Data bundle purchase
- Cable TV validation and subscription
- Electricity meter validation and payment
- Education pin purchase
- Transaction status checking

### Monnify Payment Gateway

Wallet funding is powered by [Monnify](https://monnify.com/), integrated in `app/dashboard/fund/page.tsx`. Users can:

- Fund their wallet via card payment
- Fund via bank transfer
- View transaction status in real-time

---

## 🗄️ Database Schema

The application uses Supabase PostgreSQL database with the following main tables:

- **users** – User profiles and wallet balances
- **transactions** – Transaction history and records
- **services** – Available VTU services and pricing

See `supabase/schema.sql` for the complete database schema.

---

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add your environment variables in the Vercel dashboard
5. Deploy!

The application is optimized for Vercel's infrastructure and includes automatic PWA generation.

### Deploy Elsewhere

This is a standard Next.js application and can be deployed to any platform that supports Node.js:

- Railway
- Render
- AWS
- DigitalOcean
- Netlify (with adapter)

---

## 🧪 Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Code Style

- TypeScript for all code
- ESLint for code quality
- Tailwind CSS for styling
- Server Components by default (use 'use client' when needed)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **MIT License** – see the LICENSE file for details.

---

## 💬 Support

For questions, issues, or feature requests:

- 🐛 [Open an issue](https://github.com/mederhoo-script/medersub_next/issues)
- 📧 Contact: [Your support email]
- 💬 Discussions: [GitHub Discussions](https://github.com/mederhoo-script/medersub_next/discussions)

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Supabase](https://supabase.com/)
- VTU services by [Inlomax](https://inlomax.com/)
- Payments by [Monnify](https://monnify.com/)

---

**Made with ❤️ by Mederhoo Script**
