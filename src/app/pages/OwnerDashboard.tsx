import { useState } from 'react';
import { Plus, IndianRupee, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
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
  const { user, getUserProperties, deleteProperty } = useApp();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Listings</h1>
          <p className="text-gray-600 mt-2">Manage your rental properties</p>
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
                      <div className="flex gap-2">
                        {getStatusBadge(property.status)}
                        <Badge variant="outline">{property.bhk}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                        <p className="text-sm text-gray-600">Status</p>
                        <p className="text-lg font-semibold text-gray-900 capitalize">
                          {property.paymentStatus}
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

                    {property.status === 'active' && (
                      <p className="text-sm text-gray-500">
                        Expires on {property.expiresAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

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