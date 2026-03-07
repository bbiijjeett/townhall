import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface Inquiry {
  id: string;
  property_id: string;
  tenant_id: string;
  message: string;
  tenant_name: string;
  tenant_email: string;
  status: 'pending' | 'seen' | 'replied';
  created_at: string;
}

interface UseOwnerInquiriesResult {
  inquiries: Inquiry[];
  isLoading: boolean;
  markAsSeen: (inquiryId: string) => Promise<void>;
}

export function useOwnerInquiries(userId: string | null): UseOwnerInquiriesResult {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading]  = useState(false);

  useEffect(() => {
    if (!userId) {
      setInquiries([]);
      return;
    }

    setIsLoading(true);
    // RLS on inquiries table restricts rows to properties owned by the current user
    supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInquiries((data as Inquiry[]) ?? []);
        setIsLoading(false);
      });
  }, [userId]);

  const markAsSeen = useCallback(async (inquiryId: string) => {
    const { error } = await supabase
      .from('inquiries')
      .update({ status: 'seen' })
      .eq('id', inquiryId)
      .eq('status', 'pending');

    if (!error) {
      setInquiries(prev =>
        prev.map(i => (i.id === inquiryId && i.status === 'pending' ? { ...i, status: 'seen' as const } : i)),
      );
    }
  }, []);

  return { inquiries, isLoading, markAsSeen };
}
