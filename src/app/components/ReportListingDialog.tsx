import { useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

type ReportReason = 'fake' | 'duplicate' | 'wrong_price' | 'offensive' | 'other';

const REASON_LABELS: Record<ReportReason, string> = {
  fake: 'Fake listing',
  duplicate: 'Duplicate listing',
  wrong_price: 'Wrong price',
  offensive: 'Offensive content',
  other: 'Other',
};

interface ReportListingDialogProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportListingDialog({ propertyId, open, onOpenChange }: ReportListingDialogProps) {
  const navigate = useNavigate();
  const { user } = useApp();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please sign in to report a listing');
      navigate('/login');
      return;
    }

    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    try {
      setIsSubmitting(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }

      const { error } = await supabase.functions.invoke('submit-listing-report', {
        body: {
          property_id: propertyId,
          reason,
          description: description.trim() || null,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        if (error.message?.includes('already reported')) {
          toast.error('You have already reported this listing recently.');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Report submitted. Our team will review it.');
      onOpenChange(false);
      setReason('');
      setDescription('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason('');
      setDescription('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Report this listing
          </DialogTitle>
          <DialogDescription>
            Help us keep TownHall safe. Reports are reviewed by our team within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">Reason *</Label>
            <Select
              value={reason}
              onValueChange={(val) => setReason(val as ReportReason)}
            >
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REASON_LABELS) as ReportReason[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {REASON_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-description">
              Additional details{' '}
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              id="report-description"
              placeholder="Describe the issue in more detail…"
              value={description}
              maxLength={300}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 resize-none"
              disabled={isSubmitting}
            />
            <p className={`text-xs text-right ${description.length >= 250 ? 'text-amber-600' : 'text-gray-400'}`}>
              {description.length}/300
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60"
              disabled={isSubmitting || !reason}
            >
              {isSubmitting && (
                <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              )}
              Submit Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
