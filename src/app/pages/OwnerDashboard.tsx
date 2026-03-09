import { useState } from 'react';
import { Plus, IndianRupee, Clock, CheckCircle, XCircle, Trash2, MessageSquare, ChevronDown, RefreshCw, AlertTriangle, Eye, Sparkles, ShoppingCart, ArrowUpCircle } from 'lucide-react';
import { BuyCreditsDialog } from '../components/BuyCreditsDialog';
import { useOwnerInquiries } from '../hooks/useOwnerInquiries';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';

export function OwnerDashboard() {
  const navigate = useNavigate();
  const { user, profile, getUserProperties, deleteProperty } = useApp();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [expandedInquiries, setExpandedInquiries] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You need to be logged in to view this page.</p>
          <Button onClick={() => navigate('/login')} className="bg-indigo-600 hover:bg-indigo-700">
            Login
          </Button>
        </Card>
      </div>
    );
  }

  const properties = getUserProperties();
  const { inquiries, markAsSeen } = useOwnerInquiries(user.id);

  const handleDelete = async (propertyId: string) => {
    try {
      await deleteProperty(propertyId);
      setDeleteDialog(null);
      toast.success('Property deleted successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete property';
      toast.error(message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending Payment
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return null;
    }
  };

  // Returns days remaining (positive = active, 0 = today, negative = overdue)
  const getDaysRemaining = (expiresAt: Date | null | undefined): number | null => {
    if (!expiresAt) return null;
    return Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Listings</h1>
            <p className="text-gray-600 mt-2">Manage your rental properties</p>
          </div>
          {profile && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Reveal credits:</span>
              {profile.reveal_unlimited ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                  <Sparkles className="w-4 h-4" />
                  Unlimited this month
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1">
                    <Eye className="w-4 h-4" />
                    {profile.reveal_credits} credit{profile.reveal_credits !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setShowBuyCredits(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full px-3 py-1 transition-colors"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Buy Credits
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Add New Property Button */}
        <Button
          onClick={() => navigate('/add-property')}
          className="w-full sm:w-auto mb-6 bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Property
        </Button>

        {/* Properties List */}
        {properties.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Properties Yet</h3>
              <p className="text-gray-600 mb-6">
                Start by posting your first rental property to reach potential tenants.
              </p>
              <Button onClick={() => navigate('/add-property')} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Post Your First Property
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {properties.map((property) => (
              <Card key={property.id} className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Property Image */}
                  <div className="w-full sm:w-48 h-48 rounded-lg overflow-hidden flex-shrink-0">
                    <ImageWithFallback
                      src={property.images[0]}
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Property Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{property.title}</h3>
                        <p className="text-gray-600 text-sm">{property.location}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getStatusBadge(property.status)}
                        <Badge variant="outline">{property.bhk}</Badge>
                        {/* Inquiry count badge */}
                        {(() => {
                          const propertyInquiries = inquiries.filter(i => i.property_id === property.id);
                          const pendingCount = propertyInquiries.filter(i => i.status === 'pending').length;
                          if (propertyInquiries.length === 0) return null;
                          return (
                            <Badge className={pendingCount > 0 ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-100'}>
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {propertyInquiries.length} {propertyInquiries.length === 1 ? 'inquiry' : 'inquiries'}
                              {pendingCount > 0 && (
                                <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-px">
                                  {pendingCount} new
                                </span>
                              )}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Monthly Rent</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ₹{property.rent.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Deposit</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ₹{property.deposit.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Plan</p>
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {property.planType ?? 'free'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Views
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          {(property.viewCount ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {property.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => navigate('/payment/' + property.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <IndianRupee className="w-4 h-4 mr-1" />
                          Pay Listing Fee
                        </Button>
                      )}
                      {property.status === 'expired' && (
                        <Button
                          size="sm"
                          onClick={() => navigate('/payment/' + property.id)}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Renew Listing
                        </Button>
                      )}
                      {property.status === 'active' && property.planType !== 'premium' && (
                        <Button
                          size="sm"
                          onClick={() => navigate('/payment/' + property.id)}
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                          <ArrowUpCircle className="w-4 h-4 mr-1" />
                          {property.planType === 'featured' ? 'Upgrade to Premium' : 'Upgrade Plan'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/property/' + property.id)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteDialog(property.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {property.status === 'active' && (() => {
                      const days = getDaysRemaining(property.expiresAt);
                      if (days === null) return null;
                      if (days <= 0) return (
                        <p className="text-sm font-medium text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Expired — renew to restore visibility
                        </p>
                      );
                      if (days <= 7) return (
                        <p className="text-sm font-medium text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Expires in {days} day{days !== 1 ? 's' : ''} —{' '}
                          <button
                            type="button"
                            onClick={() => navigate('/payment/' + property.id)}
                            className="underline hover:no-underline"
                          >
                            renew now
                          </button>
                        </p>
                      );
                      return (
                        <p className="text-sm text-gray-500">
                          Expires on {property.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' '}({days} days remaining)
                        </p>
                      );
                    })()}
                  </div>
                </div>
                {/* Inquiries expandable section */}
                {(() => {
                  const listingInquiries = inquiries.filter(i => i.property_id === property.id);
                  if (listingInquiries.length === 0) return null;
                  const pendingCount = listingInquiries.filter(i => i.status === 'pending').length;
                  const isExpanded = expandedInquiries === property.id;
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          const opening = expandedInquiries !== property.id;
                          setExpandedInquiries(opening ? property.id : null);
                          if (opening) {
                            listingInquiries
                              .filter(i => i.status === 'pending')
                              .forEach(i => markAsSeen(i.id));
                          }
                        }}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {listingInquiries.length} {listingInquiries.length === 1 ? 'Inquiry' : 'Inquiries'}
                        {pendingCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                            {pendingCount} new
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {listingInquiries.map(inquiry => (
                            <div key={inquiry.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{inquiry.tenant_name}</p>
                                  <p className="text-xs text-gray-500">{inquiry.tenant_email}</p>
                                </div>
                                <Badge
                                  className={
                                    inquiry.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs'
                                  }
                                >
                                  {inquiry.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-700">{inquiry.message}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(inquiry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Card>
            ))}
          </div>
        )}

        <BuyCreditsDialog open={showBuyCredits} onOpenChange={setShowBuyCredits} />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog !== null} onOpenChange={() => setDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Property</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this property? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="outline" onClick={() => setDeleteDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => deleteDialog && handleDelete(deleteDialog)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}