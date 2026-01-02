'use client';
import { motion } from 'framer-motion';
import { Zap, Wifi, Phone, CreditCard } from 'lucide-react';
import Link from 'next/link';

const networks = [
    {
        name: 'MTN',
        color: '#FFCC00',
        textColor: 'text-black',
        plans: ['1GB - ₦250', '2GB - ₦500', '5GB - ₦1,200'],
        icon: Wifi,
        gradient: 'from-[#FFCC00] to-[#E6B800]'
    },
    {
        name: 'Airtel',
        color: '#E40000',
        textColor: 'text-white',
        plans: ['1GB - ₦280', '2GB - ₦550', '5GB - ₦1,350'],
        icon: Wifi,
        gradient: 'from-[#E40000] to-[#B30000]'
    },
    {
        name: 'Glo',
        color: '#2ECC71',
        textColor: 'text-white',
        plans: ['1GB - ₦240', '2GB - ₦480', '5GB - ₦1,150'],
        icon: Wifi,
        gradient: 'from-[#2ECC71] to-[#27AE60]'
    },
    {
        name: '9mobile',
        color: '#006633',
        textColor: 'text-white',
        plans: ['1GB - ₦300', '2GB - ₦600', '5GB - ₦1,450'],
        icon: Wifi,
        gradient: 'from-[#006633] to-[#004D26]'
    }
];

export default function PricingCards() {
    return (
        <section className="py-24 bg-slate-50 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-green-600 font-bold tracking-[0.3em] mb-4 text-sm uppercase"
                    >
                        Best Rates
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black text-slate-900 uppercase"
                    >
                        Network <span className="text-green-600">Pricing</span>
                    </motion.h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {networks.map((network, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -10 }}
                            className={`group relative bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden transition-all duration-500 hover:border-green-500/30 hover:shadow-xl`}
                        >
                            <div className={`h-3 w-full bg-gradient-to-r ${network.gradient}`} />

                            <div className="p-10">
                                <div className={`h-16 w-16 bg-gradient-to-br ${network.gradient} rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg group-hover:scale-110 transition-transform`}>
                                    <network.icon className="h-8 w-8" />
                                </div>

                                <h3 className="text-3xl font-black text-slate-900 mb-6 uppercase tracking-tight">
                                    {network.name}
                                </h3>

                                <ul className="space-y-4 mb-10">
                                    {network.plans.map((plan, pIdx) => (
                                        <li key={pIdx} className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                                            <div className={`h-1.5 w-1.5 rounded-full bg-slate-200`} />
                                            {plan}
                                        </li>
                                    ))}
                                </ul>

                                <Link href="/dashboard/data" className="block w-full">
                                    <button className={`w-full py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border border-slate-200
                                    ${network.name === 'MTN' ? 'bg-[#FFCC00] text-black hover:bg-[#E6B800]' :
                                            network.name === 'Airtel' ? 'bg-[#E40000] text-white hover:bg-[#B30000]' :
                                                network.name === 'Glo' ? 'bg-[#2ECC71] text-white hover:bg-[#27AE60]' :
                                                    network.name === '9mobile' ? 'bg-[#006633] text-white hover:bg-[#004D26]' :
                                                        'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                                        Buy Now
                                    </button>
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
