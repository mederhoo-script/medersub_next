'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'top-0' : 'top-0'}`}>
            <div className="w-full">
                <div className={`transition-all duration-500 bg-gradient-to-r from-green-800 to-green-500 shadow-lg ${scrolled ? 'py-2' : 'py-4'}`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
                        <div className="flex-shrink-0 flex items-center gap-3">
                            <span className="font-bold text-2xl tracking-tight text-white">MEDERSUB</span>
                        </div>

                        <div className="hidden md:flex items-center space-x-8">
                            <Link href="/login" className="text-white hover:text-green-100 transition-colors text-sm font-bold uppercase">Login</Link>
                            <Link href="/register" className="text-white hover:text-green-100 transition-colors text-sm font-bold uppercase">Register</Link>
                            <Link href="#" className="text-white hover:text-green-100 transition-colors text-sm font-bold uppercase">API</Link>
                        </div>

                        <div className="md:hidden flex items-center">
                            <button onClick={() => setIsOpen(!isOpen)} className="text-white hover:text-green-100 focus:outline-none p-2">
                                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden absolute top-20 left-4 right-4 bg-green-800/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 px-4 py-6"
                    >
                        <div className="flex flex-col space-y-4">
                            <Link href="/login" onClick={() => setIsOpen(false)} className="px-4 py-3 rounded-xl text-lg font-medium text-white hover:bg-white/5 transition-colors">Login</Link>
                            <Link href="/register" onClick={() => setIsOpen(false)} className="px-4 py-3 rounded-xl text-lg font-medium text-white hover:bg-white/5 transition-colors">Register</Link>
                            <Link href="#" onClick={() => setIsOpen(false)} className="px-4 py-3 rounded-xl text-lg font-medium text-white hover:bg-white/5 transition-colors">API</Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}

