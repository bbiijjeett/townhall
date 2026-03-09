import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Flag,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

interface ListingReport {
  id: string;
  property_id: string;
  reporter_id: string | null;
  reason: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
  // joined property title via a Select
  properties: {
    title: string;
    location: string;
    status: string;
  } | null;
}

const REASON_LABELS: Record<string, string> = {
  fake: 'Fake listing',
  duplicate: 'Duplicate listing',
  wrong_price: 'Wrong price',
  offensive: 'Offensive content',
  other: 'Other',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, profileLoading } = useApp();
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionIds, setActionIds] = useState<Set<string>>(new Set());

  const isAdmin = profile?.is_verified_owner === true;

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('listing_reports')
        .select(`
          id,
          property_id,
          reporter_id,
          reason,
          description,
          resolved,
          created_at,
          properties ( title, location, status )
        `)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Supabase infers `properties` as `any[]` without generated types;
      // casting via unknown is the correct pattern here.
      setReports((data ?? []) as unknown as ListingReport[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !profileLoading) {
      if (!user) {
        navigate('/login');
        return;
      }
      if (!isAdmin) return;
      fetchReports();
    }
  }, [authLoading, profileLoading, user, isAdmin, navigate, fetchReports]);

  const markResolved = async (reportId: string) => {
    setActionIds((prev) => new Set(prev).add(reportId));
    try {
      const { error } = await supabase
        .from('listing_reports')
        .update({ resolved: true })
        .eq('id', reportId);

      if (error) throw error;
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast.success('Report marked as resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve report');
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  };

  const flagListing = async (reportId: string, propertyId: string) => {
    setActionIds((prev) => new Set(prev).add(reportId));
    try {
      // Flag the property for removal from public view
      const { error: propError } = await supabase
        .from('properties')
        .update({ status: 'flagged' })
        .eq('id', propertyId);

      if (propError) throw propError;

      // Resolve the triggering report
      const { error: repError } = await supabase
        .from('listing_reports')
        .update({ resolved: true })
        .eq('id', reportId);

      if (repError) throw repError;

      setReports((prev) => prev.filter((r) => r.id !== reportId));
      toast.success('Listing flagged and report resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to flag listing');
    } finally {
      setActionIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // ── Access denied ────────────────────────────────────────────────────────────
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="p-10 text-center max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6 text-sm">
            You do not have permission to view this page.
          </p>
          <Button onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-700">
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-red-500" />
              Reports Queue
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              {reports.length} unresolved report{reports.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReports}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">All clear!</h3>
            <p className="text-gray-500 text-sm">No unresolved reports at the moment.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const isBusy = actionIds.has(report.id);
              const isAlreadyFlagged = report.properties?.status === 'flagged';
              return (
                <Card key={report.id} className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Report details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                          <Flag className="w-3 h-3 mr-1" />
                          {REASON_LABELS[report.reason] ?? report.reason}
                        </Badge>
                        {isAlreadyFlagged && (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Listing already flagged
                          </Badge>
                        )}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {report.properties?.title ?? 'Unknown property'}
                        </p>
                        <p className="text-xs text-gray-500">{report.properties?.location}</p>
                      </div>

                      {report.description && (
                        <p className="text-sm text-gray-700 bg-gray-50 rounded p-2 border border-gray-100">
                          "{report.description}"
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>
                          Reported{' '}
                          {new Date(report.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <Link
                          to={`/property/${report.property_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5"
                        >
                          View listing <ExternalLink className="w-3 h-3 ml-0.5" />
                        </Link>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex sm:flex-col gap-2 sm:items-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markResolved(report.id)}
                        disabled={isBusy}
                        className="text-green-700 border-green-300 hover:bg-green-50"
                      >
                        {isBusy ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        )}
                        Mark Resolved
                      </Button>
                      {!isAlreadyFlagged && (
                        <Button
                          size="sm"
                          onClick={() => flagListing(report.id, report.property_id)}
                          disabled={isBusy}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 mr-1" />
                          )}
                          Flag Listing
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
