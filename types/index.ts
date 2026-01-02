export type Role = 'USER' | 'ADMIN';

export interface UserProfile {
    id: string; // references auth.users
    email: string;
    full_name?: string;
    role: Role;
    balance: number;
    created_at: string;
}

export type TransactionType = 'DEPOSIT' | 'PURCHASE' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Transaction {
    id: string;
    user_id: string;
    type: TransactionType;
    amount: number;
    service_type?: string; // e.g. 'AIRTIME', 'DATA'
    status: TransactionStatus;
    reference: string;
    meta?: any; // JSON details
    created_at: string;
}

export interface Service {
    serviceID: string;
    name: string;
    type: 'AIRTIME' | 'DATA' | 'CABLE' | 'ELECTRICITY';
    network?: string;
    amount?: number;
    variation_code?: string;
}
