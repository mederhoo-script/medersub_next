'use client';
import { motion } from 'framer-motion';

const steps = [
    { step: 'Step 1', title: 'Sign Up', desc: 'Create an account by filling in your basic details.' },
    { step: 'Step 2', title: 'Fund Wallet', desc: 'Add money to your wallet using our secure payment methods.' },
    { step: 'Step 3', title: 'Select Service', desc: 'Choose the service you want (Airtime, Data, Bills, etc.).' },
    { step: 'Step 4', title: 'Get Instant Delivery', desc: 'Enjoy immediate fulfillment of your purchase!' },
];

export default function HowItWorks() {
    return (
        <section className="py-24 bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-black text-slate-900 mb-4"
                    >
                        How It <span className="text-green-600">Works</span>
                    </motion.h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-green-500 transition-colors"
                        >
                            <div className="text-sm font-bold text-green-600 uppercase mb-4 tracking-widest">{item.step}</div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
